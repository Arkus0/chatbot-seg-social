import { ChatPromptTemplate } from "@langchain/core/prompts";

import { getEnv } from "../config/env.js";
import type { AnswerPayload } from "../types/answers.js";
import { extractMessageText } from "../utils/text.js";
import { buildRetrievalOnlyAnswer, isRetriableGenerationError } from "./fallback.js";
import { buildNoContextAnswerPayload, composeAnswerPayload, formatRetrievedChunks } from "./formatter.js";
import { invokePromptWithLlmFallback } from "./invokeWithFallback.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompt.js";
import { retrieveRelevantChunks } from "./retriever.js";

export async function answerQuestion(question: string): Promise<AnswerPayload> {
  const env = getEnv();
  const retrievedChunks = await retrieveRelevantChunks(question);

  if (retrievedChunks.length === 0) {
    return buildNoContextAnswerPayload();
  }

  const context = formatRetrievedChunks(retrievedChunks, env.MAX_CONTEXT_CHARS);
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", buildSystemPrompt()],
    ["human", "{input}"],
  ]);

  try {
    const response = await invokePromptWithLlmFallback(prompt, {
      input: buildUserPrompt(question, context),
    });

    return composeAnswerPayload(extractMessageText((response as { content?: unknown }).content), retrievedChunks);
  } catch (error) {
    if (isRetriableGenerationError(error)) {
      return buildRetrievalOnlyAnswer(question, retrievedChunks);
    }

    throw error;
  }
}
