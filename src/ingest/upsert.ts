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
  const sources = await loadSeedSources();

  for (const source of sources) {
    logger.info("Loading source", { url: source.url });

    const loaded = await loadSource(source);
    const documents = await chunkSourceDocument(loaded);
    const ids = documents.map((document) => buildChunkId(document.metadata.url, document.metadata.chunkIndex));

    await store.addDocuments(documents, { ids });

    logger.info("Upsert completed", {
      url: source.url,
      chunks: documents.length,
    });
  }
}
