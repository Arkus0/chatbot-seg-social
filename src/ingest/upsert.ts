import { createHash } from "node:crypto";

import { assertRagEnv, getEnv } from "../config/env.js";
import { getPineconeClient, getVectorStore } from "../rag/vectorstore.js";
import { logger } from "../utils/logger.js";
import { chunkSourceDocument } from "./chunk.js";
import { loadSource } from "./loaders.js";
import { loadSeedSources } from "./sources.js";

function buildChunkId(url: string, chunkIndex: number): string {
  return createHash("sha256").update(`${url}:${chunkIndex}`).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function extractRetryDelayMs(error: unknown): number {
  const message = String(error ?? "");
  const retryDelayMatch = message.match(/retry in ([\d.]+)s/i);

  if (!retryDelayMatch) {
    return 1500;
  }

  const seconds = Number.parseFloat(retryDelayMatch[1] ?? "");

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 1500;
  }

  return Math.ceil(seconds * 1000);
}

function isRetriableUpsertError(error: unknown): boolean {
  const message = String(error ?? "").toLowerCase();
  return message.includes("[429") || message.includes("quota") || message.includes("rate limit");
}

function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }

  return batches;
}

async function addDocumentsWithRetry(
  store: Awaited<ReturnType<typeof getVectorStore>>,
  documents: Awaited<ReturnType<typeof chunkSourceDocument>>,
  ids: string[],
  namespace: string,
  batchIndex: number,
  batchCount: number,
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await store.addDocuments(documents, { ids, namespace });
      return;
    } catch (error) {
      lastError = error;
      logger.warn("Upsert attempt failed", {
        attempt,
        batchIndex,
        batchCount,
        batchSize: documents.length,
        namespace,
        error,
      });

      if (!isRetriableUpsertError(error) || attempt === 3) {
        break;
      }

      const retryDelayMs = extractRetryDelayMs(error);
      await sleep(retryDelayMs);
    }
  }

  throw lastError;
}

async function areAllChunkIdsPresent(ids: string[], namespace: string): Promise<boolean> {
  if (ids.length === 0) {
    return false;
  }

  const env = getEnv();
  const index = getPineconeClient().index(env.PINECONE_INDEX_NAME!).namespace(namespace);
  const fetched = await index.fetch(ids);

  return ids.every((id) => Boolean(fetched.records[id]));
}

async function upsertDocumentsInBatches(
  store: Awaited<ReturnType<typeof getVectorStore>>,
  documents: Awaited<ReturnType<typeof chunkSourceDocument>>,
  ids: string[],
  namespace: string,
): Promise<void> {
  const env = getEnv();
  const documentBatches = splitIntoBatches(documents, env.INGEST_UPSERT_BATCH_SIZE);
  const idBatches = splitIntoBatches(ids, env.INGEST_UPSERT_BATCH_SIZE);
  let processedChunks = 0;

  for (const [batchIndex, documentBatch] of documentBatches.entries()) {
    const idBatch = idBatches[batchIndex] ?? [];

    if (idBatch.length === 0) {
      continue;
    }

    if (!env.FORCE_REEMBED_EXISTING && (await areAllChunkIdsPresent(idBatch, namespace))) {
      processedChunks += idBatch.length;
      logger.info("Skipping ingestion batch already present in Pinecone namespace", {
        namespace,
        batchIndex: batchIndex + 1,
        batchCount: documentBatches.length,
        batchSize: idBatch.length,
        processedChunks,
        totalChunks: ids.length,
      });
      continue;
    }

    await addDocumentsWithRetry(store, documentBatch, idBatch, namespace, batchIndex + 1, documentBatches.length);
    processedChunks += idBatch.length;

    logger.info("Upsert batch completed", {
      namespace,
      batchIndex: batchIndex + 1,
      batchCount: documentBatches.length,
      batchSize: idBatch.length,
      processedChunks,
      totalChunks: ids.length,
    });

    if (env.INGEST_UPSERT_THROTTLE_MS > 0) {
      await sleep(env.INGEST_UPSERT_THROTTLE_MS);
    }
  }
}

export async function ensurePineconeIndex(): Promise<void> {
  const env = getEnv();
  assertRagEnv(env);

  const client = getPineconeClient();
  const indexList = await client.listIndexes();
  const exists = indexList.indexes?.some((index) => index.name === env.PINECONE_INDEX_NAME);

  if (exists) {
    return;
  }

  logger.info("Creating Pinecone index", {
    index: env.PINECONE_INDEX_NAME,
  });

  await client.createIndex({
    name: env.PINECONE_INDEX_NAME!,
    dimension: env.EMBEDDING_DIMENSION,
    metric: "cosine",
    waitUntilReady: true,
    spec: {
      serverless: {
        cloud: env.PINECONE_CLOUD,
        region: env.PINECONE_REGION,
      },
    },
  });
}

export async function ingestConfiguredSources(): Promise<void> {
  await ensurePineconeIndex();

  const store = await getVectorStore();
  const env = getEnv();
  const sources = await loadSeedSources();

  if (env.RESET_VECTOR_NAMESPACE) {
    logger.info("Resetting Pinecone namespace before ingestion", {
      index: env.PINECONE_INDEX_NAME,
      namespace: env.PINECONE_NAMESPACE,
    });

    await store.delete({
      deleteAll: true,
      namespace: env.PINECONE_NAMESPACE,
    });
  } else {
    logger.info("Skipping namespace reset; ingestion will upsert incrementally", {
      index: env.PINECONE_INDEX_NAME,
      namespace: env.PINECONE_NAMESPACE,
    });
  }

  for (const source of sources) {
    logger.info("Loading source", { url: source.url });

    const loaded = await loadSource(source);
    const documents = await chunkSourceDocument(loaded);
    const ids = documents.map((document) => buildChunkId(document.metadata.url, document.metadata.chunkIndex));

    if (!env.FORCE_REEMBED_EXISTING && (await areAllChunkIdsPresent(ids, env.PINECONE_NAMESPACE))) {
      logger.info("Skipping source already present in Pinecone namespace", {
        url: source.url,
        chunks: documents.length,
        namespace: env.PINECONE_NAMESPACE,
      });
      continue;
    }

    await upsertDocumentsInBatches(store, documents, ids, env.PINECONE_NAMESPACE);

    logger.info("Upsert completed", {
      url: source.url,
      chunks: documents.length,
    });
  }
}
