import { TaskType } from "@google/generative-ai";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

import { assertGenerationEnv, getEnv } from "../config/env.js";

let geminiChatModel: ChatGoogleGenerativeAI | undefined;
let geminiEmbeddings: GoogleGenerativeAIEmbeddings | undefined;

export function getGeminiChatModel(): ChatGoogleGenerativeAI {
  if (geminiChatModel) {
    return geminiChatModel;
  }

  const env = getEnv();
  assertGenerationEnv(env);

  geminiChatModel = new ChatGoogleGenerativeAI({
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
    temperature: 0.1,
    maxOutputTokens: 1024,
  });

  return geminiChatModel;
}

export function getGeminiEmbeddings(): GoogleGenerativeAIEmbeddings {
  if (geminiEmbeddings) {
    return geminiEmbeddings;
  }

  const env = getEnv();

  if (!env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  geminiEmbeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: env.GEMINI_API_KEY,
    model: env.EMBEDDING_MODEL,
    taskType: TaskType.RETRIEVAL_DOCUMENT,
    title: "Seguridad Social España",
  });

  return geminiEmbeddings;
}
