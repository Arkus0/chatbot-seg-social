import type { AnswerPayload } from "../types/answers.js";

import { assertRuntimeConfig, getEnv, getRequiredBotMode } from "../config/env.js";
import { answerQuestion } from "./answerQuestion.js";
import { answerWithLlm } from "./answerWithLlm.js";

export async function getAnswer(question: string): Promise<AnswerPayload> {
  const env = getEnv();
  assertRuntimeConfig(env, "chat");
  const botMode = getRequiredBotMode(env);

  if (botMode === "echo") {
    return {
      text: `Eco: ${question}`,
      sources: [],
      summary: `Eco: ${question}`,
      keyPoints: [],
      legalNotice: "",
    };
  }

  if (botMode === "llm") {
    return answerWithLlm(question);
  }

  return answerQuestion(question);
}
