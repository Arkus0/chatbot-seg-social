import type { RetrievedChunk } from "../types/documents.js";

import { getEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { retrieveLexicalFallbackChunks } from "./lexicalRetriever.js";
import { expandQuestion, rerankRetrievedChunks } from "./query.js";
import { getVectorStore } from "./vectorstore.js";

async function retrieveVectorChunks(question: string): Promise<RetrievedChunk[]> {
  const env = getEnv();
  const store = await getVectorStore();
  const expandedQuestion = expandQuestion(question);
  const results = await store.similaritySearchWithScore(expandedQuestion, Math.min(env.RAG_TOP_K * 3, 15));

  const chunks = results
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
        priority: Number(document.metadata.priority ?? 1),
      },
    }))
    .filter((chunk) => chunk.score >= env.RAG_MIN_SCORE);

  return rerankRetrievedChunks(question, chunks, env.RAG_TOP_K);
}

export async function retrieveRelevantChunks(question: string): Promise<RetrievedChunk[]> {
  try {
    const vectorChunks = await retrieveVectorChunks(question);

    if (vectorChunks.length > 0) {
      return vectorChunks;
    }
  } catch (error) {
    logger.warn("Vector retrieval failed, using lexical fallback corpus", { error });
  }

  return retrieveLexicalFallbackChunks(question);
}
