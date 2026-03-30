import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { createHash } from "node:crypto";

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

function buildLocalEmbedding(text: string, dimension: number): number[] {
  const vector = new Array<number>(dimension).fill(0);
  const normalized = text.trim().toLowerCase();

  if (!normalized) {
    return vector;
  }

  const digest = createHash("sha256").update(normalized).digest();
  const norm = Math.sqrt(dimension);

  for (let index = 0; index < dimension; index += 1) {
    const byte = digest[index % digest.length] ?? 0;
    vector[index] = ((byte / 255) * 2 - 1) / norm;
  }

  return vector;
}

class LocalEmbeddingsAdapter implements EmbeddingsInterface {
  constructor(private readonly dimension: number) {}

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map((text) => buildLocalEmbedding(text, this.dimension));
  }

  async embedQuery(text: string): Promise<number[]> {
    return buildLocalEmbedding(text, this.dimension);
  }
}

class OpenAIEmbeddingsAdapter implements EmbeddingsInterface {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  private async embed(input: string | string[]): Promise<number[][]> {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI embeddings request failed (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };

    return payload.data.map((item) => item.embedding);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embed(texts);
  }

  async embedQuery(text: string): Promise<number[]> {
    const vectors = await this.embed(text);
    return vectors[0] ?? [];
  }
}

class VoyageEmbeddingsAdapter implements EmbeddingsInterface {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  private async embed(input: string[]): Promise<number[][]> {
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Voyage embeddings request failed (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };

    return payload.data.map((item) => item.embedding);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embed(texts);
  }

  async embedQuery(text: string): Promise<number[]> {
    const vectors = await this.embed([text]);
    return vectors[0] ?? [];
  }
}

const cachedEmbeddings = new Map<string, EmbeddingsInterface>();

export function getEmbeddings(): EmbeddingsInterface {
  const env = getEnv();
  const cacheKey = [env.EMBEDDING_PROVIDER, env.EMBEDDING_MODEL, env.EMBEDDING_DIMENSION].join(":");

  const cached = cachedEmbeddings.get(cacheKey);

  if (cached) {
    return cached;
  }

  if (env.EMBEDDING_PROVIDER === "gemini") {
    const adapter = new GeminiEmbeddingsAdapter();
    cachedEmbeddings.set(cacheKey, adapter);
    return adapter;
  }

  if (env.EMBEDDING_PROVIDER === "local") {
    const adapter = new LocalEmbeddingsAdapter(env.EMBEDDING_DIMENSION);
    cachedEmbeddings.set(cacheKey, adapter);
    return adapter;
  }

  if (env.EMBEDDING_PROVIDER === "openai") {
    if (!env.OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY");
    }

    const model = env.EMBEDDING_MODEL === "gemini-embedding-001" ? "text-embedding-3-large" : env.EMBEDDING_MODEL;
    const adapter = new OpenAIEmbeddingsAdapter(env.OPENAI_API_KEY, model);
    cachedEmbeddings.set(cacheKey, adapter);
    return adapter;
  }

  if (env.EMBEDDING_PROVIDER === "voyage") {
    if (!env.VOYAGE_API_KEY) {
      throw new Error("Missing VOYAGE_API_KEY");
    }

    const model = env.EMBEDDING_MODEL === "gemini-embedding-001" ? "voyage-3-large" : env.EMBEDDING_MODEL;
    const adapter = new VoyageEmbeddingsAdapter(env.VOYAGE_API_KEY, model);
    cachedEmbeddings.set(cacheKey, adapter);
    return adapter;
  }

  throw new Error(`Unsupported embedding provider: ${env.EMBEDDING_PROVIDER}`);
}
