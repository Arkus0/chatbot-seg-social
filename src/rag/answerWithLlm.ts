import { ChatPromptTemplate } from "@langchain/core/prompts";

import type { AnswerPayload } from "../types/answers.js";
import { extractMessageText } from "../utils/text.js";
import { composeStandaloneAnswerPayload } from "./formatter.js";
import { invokePromptWithLlmFallback } from "./invokeWithFallback.js";

function buildLlmOnlySystemPrompt(): string {
  return [
    "Eres un asistente informativo sobre la Seguridad Social española.",
    "No inventes leyes ni procedimientos.",
    "Si no estás seguro de un dato, dilo claramente.",
    "No des asesoramiento jurídico personalizado.",
    "Responde de forma breve y prudente.",
  ].join("\n");
}

export async function answerWithLlm(question: string): Promise<AnswerPayload> {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", buildLlmOnlySystemPrompt()],
    ["human", "{question}"],
  ]);

  const response = await invokePromptWithLlmFallback(prompt, { question });

  return composeStandaloneAnswerPayload(extractMessageText((response as { content?: unknown }).content));
}
