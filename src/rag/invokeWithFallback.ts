import type { ChatPromptTemplate } from "@langchain/core/prompts";

import { getEnv } from "../config/env.js";
import { getChatModel, getFallbackProvider } from "../providers/llm.js";
import { logger } from "../utils/logger.js";
import { isRetriableGenerationError } from "./fallback.js";

export async function invokePromptWithLlmFallback(
  prompt: ChatPromptTemplate,
  input: Record<string, string>,
): Promise<unknown> {
  const env = getEnv();

  try {
    return await prompt.pipe(getChatModel(env.LLM_PROVIDER)).invoke(input);
  } catch (error) {
    const fallbackProvider = getFallbackProvider(env.LLM_PROVIDER);

    if (!isRetriableGenerationError(error) || !fallbackProvider) {
      throw error;
    }

    logger.warn("Primary LLM unavailable, using fallback provider", {
      primaryProvider: env.LLM_PROVIDER,
      fallbackProvider,
    });

    return prompt.pipe(getChatModel(fallbackProvider)).invoke(input);
  }
}
