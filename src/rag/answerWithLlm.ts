import { ChatPromptTemplate } from "@langchain/core/prompts";

import type { AnswerPayload } from "../types/answers.js";
import { extractMessageText } from "../utils/text.js";
import { composeStandaloneAnswerPayload } from "./formatter.js";
import { invokePromptWithLlmFallback } from "./invokeWithFallback.js";

function buildLlmOnlySystemPrompt(): string {
  return [
    "Eres un asistente informativo sobre la Seguridad Social espanola.",
    "No inventes leyes ni procedimientos.",
    "Si no estas seguro de un dato, dilo claramente.",
    "No des asesoramiento juridico personalizado.",
    "Explica las cosas con palabras sencillas, como a alguien con poca familiaridad con tramites administrativos.",
    "Si el usuario pregunta por rellenar una solicitud, orienta solo de forma general y di claramente lo que no puedes confirmar.",
    "Responde de forma breve, ordenada y prudente.",
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
