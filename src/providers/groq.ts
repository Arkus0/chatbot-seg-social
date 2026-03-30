import { ChatGroq } from "@langchain/groq";

import { assertGenerationEnv, getEnv } from "../config/env.js";

let groqChatModel: ChatGroq | undefined;

export function getGroqChatModel(): ChatGroq {
  if (groqChatModel) {
    return groqChatModel;
  }

  const env = getEnv();
  assertGenerationEnv(env);

  groqChatModel = new ChatGroq({
    apiKey: env.GROQ_API_KEY,
    model: env.GROQ_MODEL,
    temperature: 0.1,
    maxTokens: 1024,
  });

  return groqChatModel;
}
