import type { ChatState } from "../types/answers.js";
import { ChatPromptTemplate } from "@langchain/core/prompts";

import { getEnv } from "../config/env.js";
import type { AnswerPayload } from "../types/answers.js";
import { extractMessageText } from "../utils/text.js";
import { buildRetrievalOnlyAnswer, isRetriableGenerationError } from "./fallback.js";
import { analyzeConversation } from "./conversation.js";
import { buildClarificationPayload, buildNoContextAnswerPayload, composeAnswerPayload, formatRetrievedChunks } from "./formatter.js";
import { invokePromptWithLlmFallback } from "./invokeWithFallback.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompt.js";
import { retrieveRelevantChunks } from "./retriever.js";

export async function answerQuestion(question: string, state?: ChatState): Promise<AnswerPayload> {
  const env = getEnv();
  const analysis = analyzeConversation(question, state);

  if (analysis.shouldClarify) {
    return buildClarificationPayload({
      intent: analysis.intent,
      state: analysis.state,
      clarifyingQuestions: analysis.clarifyingQuestions,
      suggestedReplies: analysis.suggestedReplies,
    });
  }

  const retrievedChunks = await retrieveRelevantChunks(analysis.retrievalQuestion, {
    benefitId: analysis.intent.benefitId,
    family: analysis.intent.family,
    operation: analysis.intent.operation,
    lifecycle: analysis.intent.lifecycleStage,
  });

  if (retrievedChunks.length === 0) {
    return buildNoContextAnswerPayload({
      intent: analysis.intent,
      state: analysis.state,
      suggestedReplies: analysis.suggestedReplies,
    });
  }

  const context = formatRetrievedChunks(retrievedChunks, env.MAX_CONTEXT_CHARS);
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", buildSystemPrompt()],
    ["human", "{input}"],
  ]);

  try {
    const response = await invokePromptWithLlmFallback(prompt, {
      input: buildUserPrompt(question, context, analysis.intent, analysis.state),
    });

    return composeAnswerPayload(extractMessageText((response as { content?: unknown }).content), retrievedChunks, {
      intent: analysis.intent,
      state: analysis.state,
      suggestedReplies: analysis.suggestedReplies,
    });
  } catch (error) {
    if (isRetriableGenerationError(error)) {
      return buildRetrievalOnlyAnswer(question, retrievedChunks, analysis.intent, analysis.state, analysis.suggestedReplies);
    }

    throw error;
  }
}
