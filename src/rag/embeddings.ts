import type { EmbeddingsInterface } from "@langchain/core/embeddings";

import { getEnv } from "../config/env.js";
import { getGeminiEmbeddings } from "../providers/gemini.js";

export function getEmbeddings(): EmbeddingsInterface {
  const env = getEnv();

  if (env.EMBEDDING_PROVIDER === "gemini") {
    return getGeminiEmbeddings();
  }

  throw new Error(`Unsupported embedding provider: ${env.EMBEDDING_PROVIDER}`);
}
