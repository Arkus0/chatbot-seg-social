import type { EmbeddingsInterface } from "@langchain/core/embeddings";

import { getEnv } from "../config/env.js";
import { getGeminiDocumentEmbeddings, getGeminiQueryEmbeddings } from "../providers/gemini.js";
import { logger } from "../utils/logger.js";
import { markEmbeddingsUnavailable } from "./embeddingAvailability.js";

const DEFAULT_RETRY_DELAY_MS = 2000;
const MAX_RETRY_DELAY_MS = 4000;
const MAX_EMBEDDING_ATTEMPTS = 2;

type EmbeddingAttemptMeta = {
  attempts: number;
  retriable429Failures: number;
};

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

function isRateLimitError(error: unknown): boolean {
  return String(error ?? "").includes("[429");
}

function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }

  return batches;
}

async function withEmbeddingRetry<T>(
  label: string,
  operation: () => Promise<T>,
): Promise<{ value: T; meta: EmbeddingAttemptMeta }> {
  let lastError: unknown;
  let retriable429Failures = 0;

  for (let attempt = 1; attempt <= MAX_EMBEDDING_ATTEMPTS; attempt += 1) {
    try {
      const value = await operation();
      return {
        value,
        meta: {
          attempts: attempt,
          retriable429Failures,
        },
      };
    } catch (error) {
      lastError = error;

      if (isRateLimitError(error)) {
        retriable429Failures += 1;
      }

      if (!isRetriableEmbeddingError(error) || attempt === MAX_EMBEDDING_ATTEMPTS) {
        if (isRetriableEmbeddingError(error)) {
          markEmbeddingsUnavailable(getEnv().EMBEDDING_COOLDOWN_MS);
        }
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
    if (texts.length === 0) {
      return [];
    }

    const env = getEnv();
    const documentEmbeddings = getGeminiDocumentEmbeddings();
    const vectors: number[][] = [];
    const batches = splitIntoBatches(texts, env.EMBED_BATCH_SIZE);

    for (const [batchIndex, batch] of batches.entries()) {
      const batchStart = Date.now();
      const { value: batchVectors, meta } = await withEmbeddingRetry("document-batch", async () =>
        documentEmbeddings.embedDocuments(batch),
      );

      if (batchVectors.length !== batch.length) {
        throw new Error(
          `Gemini returned ${batchVectors.length} embeddings for batch of ${batch.length} document chunks.`,
        );
      }

      for (const vector of batchVectors) {
        if (vector.length === 0) {
          throw new Error("Gemini returned an empty embedding for a document chunk.");
        }

        vectors.push(vector);
      }

      const elapsedMs = Date.now() - batchStart;
      const retries = Math.max(0, meta.attempts - 1);
      const rateLimit429Ratio = retries === 0 ? 0 : meta.retriable429Failures / retries;
      logger.info("Embedding batch completed", {
        batchIndex: batchIndex + 1,
        batchCount: batches.length,
        batchSize: batch.length,
        elapsedMs,
        retries,
        retriable429Failures: meta.retriable429Failures,
        rateLimit429Ratio,
      });

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
        markEmbeddingsUnavailable(getEnv().EMBEDDING_COOLDOWN_MS);
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
