import type { AnswerPayload } from "../types/answers.js";

import { getEnv } from "../config/env.js";
import { answerQuestion } from "./answerQuestion.js";
import { answerWithLlm } from "./answerWithLlm.js";

export async function getAnswer(question: string): Promise<AnswerPayload> {
  const env = getEnv();

  if (env.BOT_MODE === "echo") {
    return {
      text: `Eco: ${question}`,
      sources: [],
      summary: `Eco: ${question}`,
      keyPoints: [],
      legalNotice: "",
    };
  }

  if (env.BOT_MODE === "llm") {
    return answerWithLlm(question);
  }

  return answerQuestion(question);
}
