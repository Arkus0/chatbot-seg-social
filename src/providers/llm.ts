import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import { getEnv } from "../config/env.js";
import { getGeminiChatModel } from "./gemini.js";
import { getGroqChatModel } from "./groq.js";

export type SupportedLlmProvider = "gemini" | "groq";

export function getChatModel(provider?: SupportedLlmProvider): BaseChatModel {
  const env = getEnv();
  const resolvedProvider = provider ?? env.LLM_PROVIDER;

  if (resolvedProvider === "groq") {
    return getGroqChatModel();
  }

  return getGeminiChatModel();
}

export function getFallbackProvider(provider?: SupportedLlmProvider): SupportedLlmProvider | undefined {
  const env = getEnv();
  const resolvedProvider = provider ?? env.LLM_PROVIDER;

  if (resolvedProvider === "gemini" && env.GROQ_API_KEY) {
    return "groq";
  }

  if (resolvedProvider === "groq" && env.GEMINI_API_KEY) {
    return "gemini";
  }

  return undefined;
}
