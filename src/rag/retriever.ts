import type { RetrievedChunk } from "../types/documents.js";

import { getEnv } from "../config/env.js";
import { stripChunkSearchContext } from "../ingest/chunk.js";
import { logger } from "../utils/logger.js";
import { areEmbeddingsTemporarilyUnavailable, getEmbeddingCooldownRemainingMs } from "./embeddingAvailability.js";
import { retrieveLexicalFallbackChunks } from "./lexicalRetriever.js";
import type { RetrievalIntentContext } from "./query.js";
import { expandQuestion, rerankRetrievedChunks } from "./query.js";
import { getVectorStore } from "./vectorstore.js";

const MIN_LEXICAL_FAST_PATH_RESULTS = 3;

async function retrieveVectorChunks(question: string, context?: RetrievalIntentContext): Promise<RetrievedChunk[]> {
  const env = getEnv();
  const store = await getVectorStore();
  const expandedQuestion = expandQuestion(question);
  const results = await store.similaritySearchWithScore(expandedQuestion, Math.min(env.RAG_TOP_K * 3, 15));

  const chunks = results
    .map(([document, score]) => ({
      pageContent: stripChunkSearchContext(document.pageContent),
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
        searchText: String(document.metadata.searchText ?? ""),
        benefitId: document.metadata.benefitId ? String(document.metadata.benefitId) : undefined,
        family: document.metadata.family ? String(document.metadata.family) : undefined,
        lifecycle: document.metadata.lifecycle ? String(document.metadata.lifecycle) : undefined,
        sourceKind: document.metadata.sourceKind ? String(document.metadata.sourceKind) : undefined,
        requiresAuth: typeof document.metadata.requiresAuth === "boolean" ? document.metadata.requiresAuth : undefined,
        supportsSms: typeof document.metadata.supportsSms === "boolean" ? document.metadata.supportsSms : undefined,
        formCodes: Array.isArray(document.metadata.formCodes)
          ? document.metadata.formCodes.map((code) => String(code))
          : undefined,
      },
    }))
    .filter((chunk) => chunk.score >= env.RAG_MIN_SCORE);

  return rerankRetrievedChunks(question, chunks, env.RAG_TOP_K, context);
}

function mergeRetrievedChunks(...chunkGroups: RetrievedChunk[][]): RetrievedChunk[] {
  const merged = new Map<string, RetrievedChunk>();

  for (const chunks of chunkGroups) {
    for (const chunk of chunks) {
      const key = `${chunk.metadata.url}:${chunk.metadata.chunkIndex}`;
      const existing = merged.get(key);

      if (!existing || chunk.score > existing.score) {
        merged.set(key, chunk);
      }
    }
  }

  return [...merged.values()];
}

function shouldUseLexicalFastPath(chunks: RetrievedChunk[], topK: number): boolean {
  return chunks.length >= Math.min(topK, MIN_LEXICAL_FAST_PATH_RESULTS);
}

export async function retrieveRelevantChunks(question: string, context?: RetrievalIntentContext): Promise<RetrievedChunk[]> {
  const env = getEnv();
  const lexicalChunks = await retrieveLexicalFallbackChunks(question, context);

  if (shouldUseLexicalFastPath(lexicalChunks, env.RAG_TOP_K)) {
    return lexicalChunks;
  }

  let vectorChunks: RetrievedChunk[] = [];

  if (areEmbeddingsTemporarilyUnavailable()) {
    logger.info("Skipping vector retrieval due to embedding cooldown", {
      cooldownRemainingMs: getEmbeddingCooldownRemainingMs(),
    });
  } else {
    try {
      vectorChunks = await retrieveVectorChunks(question, context);
    } catch (error) {
      logger.warn("Vector retrieval failed, using lexical fallback corpus", { error });
    }
  }

  const combinedChunks = mergeRetrievedChunks(vectorChunks, lexicalChunks);

  if (combinedChunks.length === 0) {
    return [];
  }

  return rerankRetrievedChunks(question, combinedChunks, env.RAG_TOP_K, context);
}
