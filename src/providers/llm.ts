import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import { getEnv } from "../config/env.js";
import { getGeminiChatModel } from "./gemini.js";
import { getGroqChatModel } from "./groq.js";

export function getChatModel(): BaseChatModel {
  const env = getEnv();

  if (env.LLM_PROVIDER === "groq") {
    return getGroqChatModel();
  }

  return getGeminiChatModel();
}
