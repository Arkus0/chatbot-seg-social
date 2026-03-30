import type { RetrievedChunk } from "../types/documents.js";

import { getEnv } from "../config/env.js";
import { getVectorStore } from "./vectorstore.js";

export async function retrieveRelevantChunks(question: string): Promise<RetrievedChunk[]> {
  const env = getEnv();
  const store = await getVectorStore();
  const results = await store.similaritySearchWithScore(question, env.RAG_TOP_K);

  return results
    .map(([document, score]) => ({
      pageContent: document.pageContent,
      score,
      metadata: {
        url: String(document.metadata.url ?? ""),
        title: String(document.metadata.title ?? "Documento oficial"),
        sourceType: String(document.metadata.sourceType ?? "html"),
        chunkIndex: Number(document.metadata.chunkIndex ?? 0),
        tags: Array.isArray(document.metadata.tags)
          ? document.metadata.tags.map((tag) => String(tag))
          : [],
      },
    }))
    .filter((chunk) => chunk.score >= env.RAG_MIN_SCORE);
}
