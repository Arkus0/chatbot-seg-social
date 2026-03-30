import type { ChatState } from "../types/answers.js";
import { ChatPromptTemplate } from "@langchain/core/prompts";

import { getEnv } from "../config/env.js";
import type { AnswerPayload } from "../types/answers.js";
import type { RetrievedChunk } from "../types/documents.js";
import { extractMessageText } from "../utils/text.js";
import { logger } from "../utils/logger.js";
import { buildRetrievalOnlyAnswer, isRetriableGenerationError } from "./fallback.js";
import { analyzeConversation } from "./conversation.js";
import { buildClarificationPayload, buildNoContextAnswerPayload, composeAnswerPayload, formatRetrievedChunks } from "./formatter.js";
import { invokePromptWithLlmFallback } from "./invokeWithFallback.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompt.js";
import { retrieveRelevantChunks } from "./retriever.js";

function isStudyFocusedQuestion(question: string): boolean {
  return /\bestudios\b|\berasmus\b|\buniversidad\b|\bprograma oficial\b/i.test(question);
}

function sanitizeRetrievedChunks(question: string, chunks: RetrievedChunk[]): RetrievedChunk[] {
  const allowStudySpecific = isStudyFocusedQuestion(question);
  const keepTseComparisonContext = /\btse\b|\bcps\b|\burgente\b|\bviaj/i.test(question);
  let filtered = chunks;

  if (!allowStudySpecific) {
    filtered = filtered.filter((chunk) => {
      const haystack = `${chunk.metadata.title} ${chunk.metadata.searchText ?? ""} ${chunk.pageContent.slice(0, 700)}`;
      return !(
        chunk.metadata.benefitId === "tse-cps" && /\bestudios\b|\berasmus\b|\btitulo publico oficial\b|\bprogramas oficiales\b/i.test(haystack)
      );
    });
  }

  const hasNonFormAlternative = filtered.some((chunk) => chunk.metadata.sourceKind && chunk.metadata.sourceKind !== "form");
  if (hasNonFormAlternative && !/\brellen|cumpliment|casilla|formulario|modelo|impreso\b/i.test(question)) {
    filtered = filtered.filter(
      (chunk) => chunk.metadata.sourceKind !== "form" || (keepTseComparisonContext && chunk.metadata.benefitId === "tse-cps"),
    );
  }

  return filtered.length > 0 ? filtered : chunks;
}

function hasUnsafeMixedContext(intentBenefitId: string | undefined, chunks: RetrievedChunk[]): boolean {
  const candidateBenefitIds = [...new Set(chunks.slice(0, 3).map((chunk) => chunk.metadata.benefitId).filter(Boolean))];

  if (intentBenefitId && candidateBenefitIds.some((benefitId) => benefitId !== intentBenefitId)) {
    return true;
  }

  return false;
}

export async function answerQuestion(question: string, state?: ChatState): Promise<AnswerPayload> {
  const env = getEnv();
  const startedAt = Date.now();
  const analysis = analyzeConversation(question, state);

  if (analysis.shouldClarify) {
    const answer = buildClarificationPayload({
      intent: analysis.intent,
      state: analysis.state,
      clarifyingQuestions: analysis.clarifyingQuestions,
      recommendedActions: analysis.recommendedActions,
      suggestedReplies: analysis.suggestedReplies,
    });
    logger.info("Chat answer ready", {
      elapsedMs: Date.now() - startedAt,
      questionLength: question.length,
      retrievalStrategy: "none",
      benefitId: answer.benefitId,
      operation: answer.intent.operation,
      decisionStatus: answer.decisionStatus,
      sourceTitles: [],
    });
    return answer;
  }

  const retrievalResult = await retrieveRelevantChunks(analysis.retrievalQuestion, {
    benefitId: analysis.intent.benefitId,
    family: analysis.intent.family,
    operation: analysis.intent.operation,
    lifecycle: analysis.intent.lifecycleStage,
  });
  const retrievedChunks = sanitizeRetrievedChunks(question, retrievalResult.chunks);

  if (hasUnsafeMixedContext(analysis.intent.benefitId, retrievedChunks) && analysis.state.factsPending.length > 0) {
    const answer = buildClarificationPayload({
      intent: analysis.intent,
      state: analysis.state,
      clarifyingQuestions: [`Para no desviarte, necesito confirmar ${analysis.state.factsPending[0]}.`],
      recommendedActions: analysis.recommendedActions,
      suggestedReplies: analysis.suggestedReplies,
    });
    logger.warn("Unsafe mixed retrieval context, falling back to clarification", {
      benefitId: analysis.intent.benefitId,
      retrievalStrategy: retrievalResult.strategy,
      sourceTitles: retrievedChunks.map((chunk) => chunk.metadata.title),
    });
    logger.info("Chat answer ready", {
      elapsedMs: Date.now() - startedAt,
      questionLength: question.length,
      retrievalStrategy: `${retrievalResult.strategy}-unsafe`,
      benefitId: answer.benefitId,
      operation: answer.intent.operation,
      decisionStatus: answer.decisionStatus,
      sourceTitles: [],
    });
    return answer;
  }

  if (retrievedChunks.length === 0) {
    const answer = buildNoContextAnswerPayload({
      intent: analysis.intent,
      state: analysis.state,
      recommendedActions: analysis.recommendedActions,
      suggestedReplies: analysis.suggestedReplies,
    });
    logger.info("Chat answer ready", {
      elapsedMs: Date.now() - startedAt,
      questionLength: question.length,
      retrievalStrategy: retrievalResult.strategy,
      benefitId: answer.benefitId,
      operation: answer.intent.operation,
      decisionStatus: answer.decisionStatus,
      sourceTitles: [],
    });
    return answer;
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

    const answer = composeAnswerPayload(extractMessageText((response as { content?: unknown }).content), retrievedChunks, {
      intent: analysis.intent,
      state: analysis.state,
      recommendedActions: analysis.recommendedActions,
      suggestedReplies: analysis.suggestedReplies,
    });
    logger.info("Chat answer ready", {
      elapsedMs: Date.now() - startedAt,
      questionLength: question.length,
      retrievalStrategy: retrievalResult.strategy,
      benefitId: answer.benefitId,
      operation: answer.intent.operation,
      decisionStatus: answer.decisionStatus,
      sourceTitles: answer.sources.map((source) => source.title),
    });
    return answer;
  } catch (error) {
    if (isRetriableGenerationError(error)) {
      const answer = buildRetrievalOnlyAnswer(
        question,
        retrievedChunks,
        analysis.intent,
        analysis.state,
        analysis.recommendedActions,
      );
      logger.info("Chat answer ready", {
        elapsedMs: Date.now() - startedAt,
        questionLength: question.length,
        retrievalStrategy: `${retrievalResult.strategy}-retrieval-only`,
        benefitId: answer.benefitId,
        operation: answer.intent.operation,
        decisionStatus: answer.decisionStatus,
        sourceTitles: answer.sources.map((source) => source.title),
      });
      return answer;
    }

    throw error;
  }
}
