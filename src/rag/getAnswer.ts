import type { AnswerPayload, ChatChannel, ChatState } from "../types/answers.js";

import { assertRuntimeConfig, getEnv, getRequiredBotMode } from "../config/env.js";
import { answerQuestion } from "./answerQuestion.js";
import { answerWithLlm } from "./answerWithLlm.js";

export interface GetAnswerOptions {
  channel?: ChatChannel;
  state?: ChatState;
}

export async function getAnswer(question: string, options?: GetAnswerOptions): Promise<AnswerPayload> {
  const env = getEnv();
  assertRuntimeConfig(env, "chat");
  const botMode = getRequiredBotMode(env);

  if (botMode === "echo") {
    return {
      mode: "answer",
      decisionStatus: "follow_up",
      confidence: "low",
      intent: {
        family: "general",
        operation: "general",
        lifecycleStage: "descubrimiento",
      },
      lifecycleStage: "descubrimiento",
      text: `Eco: ${question}`,
      sources: [],
      summary: `Eco: ${question}`,
      keyPoints: [],
      caseSummary: "Caso abierto sin datos suficientes.",
      checklist: [],
      alternatives: [],
      nextBestAction: "",
      legalNotice: "",
      sections: {
        immediateSteps: [],
        documents: [],
        warnings: [],
        missingInfo: [],
        caseSummary: [],
        whatChangesTheOutcome: [],
        nextStepNow: [],
        deadlinesAndWarnings: [],
        ifINSSRespondsX: [],
        alternatives: [],
      },
      clarifyingQuestions: [],
      recommendedActions: [],
      suggestedReplies: [],
      state: {
        family: "general",
        operation: "general",
        lifecycleStage: "descubrimiento",
        facts: {},
        missingFacts: [],
        factsConfirmed: {},
        factsPending: [],
        caseSummary: "Caso abierto sin datos suficientes.",
        lastRecommendedAction: "",
        updatedAt: new Date().toISOString(),
      },
    };
  }

  if (botMode === "llm") {
    return answerWithLlm(question, options?.state);
  }

  return answerQuestion(question, options?.state);
}
