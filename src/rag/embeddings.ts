import type { EmbeddingsInterface } from "@langchain/core/embeddings";

import { getEnv } from "../config/env.js";
import { getGeminiDocumentEmbeddings, getGeminiQueryEmbeddings } from "../providers/gemini.js";
import { logger } from "../utils/logger.js";

const DEFAULT_RETRY_DELAY_MS = 2000;
const MAX_RETRY_DELAY_MS = 4000;
const MAX_EMBEDDING_ATTEMPTS = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function extractRetryDelayMs(error: unknown): number {
  const message = String(error ?? "");
  const retryDelayMatch = message.match(/retry in ([\d.]+)s/i);

  if (!retryDelayMatch) {
    return DEFAULT_RETRY_DELAY_MS;
  }

  const seconds = Number.parseFloat(retryDelayMatch[1] ?? "");

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_RETRY_DELAY_MS;
  }

  return Math.min(Math.ceil(seconds * 1000), MAX_RETRY_DELAY_MS);
}

function isRetriableEmbeddingError(error: unknown): boolean {
  const message = String(error ?? "").toLowerCase();
  return message.includes("[429") || message.includes("quota") || message.includes("rate limit");
}

async function withEmbeddingRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_EMBEDDING_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetriableEmbeddingError(error) || attempt === MAX_EMBEDDING_ATTEMPTS) {
        break;
      }

      const retryDelayMs = extractRetryDelayMs(error);
      logger.warn("Gemini embedding call will be retried", {
        label,
        attempt,
        retryDelayMs,
      });
      await sleep(retryDelayMs);
    }
  }

  throw lastError;
}

class GeminiEmbeddingsAdapter implements EmbeddingsInterface {
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const documentEmbeddings = getGeminiDocumentEmbeddings();
    const vectors: number[][] = [];

    for (const text of texts) {
      const vector = await withEmbeddingRetry("document", async () => documentEmbeddings.embedQuery(text));

      if (vector.length === 0) {
        throw new Error("Gemini returned an empty embedding for a document chunk.");
      }

      vectors.push(vector);
      await sleep(120);
    }

    return vectors;
  }

  async embedQuery(text: string): Promise<number[]> {
    try {
      const vector = await getGeminiQueryEmbeddings().embedQuery(text);

      if (vector.length === 0) {
        throw new Error("Gemini returned an empty embedding for the query.");
      }

      return vector;
    } catch (error) {
      if (isRetriableEmbeddingError(error)) {
        logger.warn("Query embedding unavailable, skipping vector retrieval", {
          error: String(error),
        });
        throw error;
      }

      logger.warn("Query-task embedding failed, falling back to document-task embedding", {
        error: String(error),
      });

      const fallbackVector = await getGeminiDocumentEmbeddings().embedQuery(text);

      if (fallbackVector.length === 0) {
        throw new Error("Gemini returned an empty fallback embedding for the query.", {
          cause: error,
        });
      }

      return fallbackVector;
    }
  }
}

let cachedEmbeddings: EmbeddingsInterface | undefined;

export function getEmbeddings(): EmbeddingsInterface {
  const env = getEnv();

  if (env.EMBEDDING_PROVIDER === "gemini") {
    cachedEmbeddings ??= new GeminiEmbeddingsAdapter();
    return cachedEmbeddings;
  }

  throw new Error(`Unsupported embedding provider: ${env.EMBEDDING_PROVIDER}`);
}
