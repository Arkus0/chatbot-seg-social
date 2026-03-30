import { TaskType } from "@google/generative-ai";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

import { getEnv } from "../config/env.js";

let geminiChatModel: ChatGoogleGenerativeAI | undefined;
let geminiDocumentEmbeddings: GoogleGenerativeAIEmbeddings | undefined;
let geminiQueryEmbeddings: GoogleGenerativeAIEmbeddings | undefined;

export function getGeminiChatModel(): ChatGoogleGenerativeAI {
  if (geminiChatModel) {
    return geminiChatModel;
  }

  const env = getEnv();

  if (!env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  geminiChatModel = new ChatGoogleGenerativeAI({
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
    temperature: 0.1,
    maxOutputTokens: 1024,
  });

  return geminiChatModel;
}

export function getGeminiDocumentEmbeddings(): GoogleGenerativeAIEmbeddings {
  if (geminiDocumentEmbeddings) {
    return geminiDocumentEmbeddings;
  }

  const env = getEnv();

  if (!env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  geminiDocumentEmbeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: env.GEMINI_API_KEY,
    model: env.EMBEDDING_MODEL,
    taskType: TaskType.RETRIEVAL_DOCUMENT,
    title: "Seguridad Social España",
  });

  return geminiDocumentEmbeddings;
}

export function getGeminiQueryEmbeddings(): GoogleGenerativeAIEmbeddings {
  if (geminiQueryEmbeddings) {
    return geminiQueryEmbeddings;
  }

  const env = getEnv();

  if (!env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  geminiQueryEmbeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: env.GEMINI_API_KEY,
    model: env.EMBEDDING_MODEL,
    taskType: TaskType.RETRIEVAL_QUERY,
  });

  return geminiQueryEmbeddings;
}
