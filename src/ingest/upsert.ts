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

async function addDocumentsWithRetry(
  store: Awaited<ReturnType<typeof getVectorStore>>,
  documents: Awaited<ReturnType<typeof chunkSourceDocument>>,
  ids: string[],
  namespace: string,
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
        namespace,
        error,
      });
      await sleep(attempt * 1500);
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

    await addDocumentsWithRetry(store, documents, ids, env.PINECONE_NAMESPACE);

    logger.info("Upsert completed", {
      url: source.url,
      chunks: documents.length,
    });

    await sleep(300);
  }
}
