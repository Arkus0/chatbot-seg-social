import type { ChatState } from "../types/answers.js";
import { ChatPromptTemplate } from "@langchain/core/prompts";

import type { AnswerPayload } from "../types/answers.js";
import { extractMessageText } from "../utils/text.js";
import { analyzeConversation } from "./conversation.js";
import { buildClarificationPayload, composeStandaloneAnswerPayload } from "./formatter.js";
import { invokePromptWithLlmFallback } from "./invokeWithFallback.js";

function buildLlmOnlySystemPrompt(): string {
  return [
    "Eres un asistente informativo sobre la Seguridad Social espanola.",
    "No inventes leyes ni procedimientos.",
    "Si no estas seguro de un dato, dilo claramente.",
    "No des asesoramiento juridico personalizado.",
    "Explica las cosas con palabras sencillas, como a alguien con poca familiaridad con tramites administrativos.",
    "Responde como un gestor del INSS: ordena el caso, da siguiente paso claro y no improvises detalles de formularios.",
    "Usa este esquema: Resumen del caso, Respuesta breve, Siguiente paso ahora, Documentos o datos, Plazos y avisos, Si faltan datos.",
  ].join("\n");
}

export async function answerWithLlm(question: string, state?: ChatState): Promise<AnswerPayload> {
  const analysis = analyzeConversation(question, state);

  if (analysis.shouldClarify) {
    return buildClarificationPayload({
      intent: analysis.intent,
      state: analysis.state,
      clarifyingQuestions: analysis.clarifyingQuestions,
      suggestedReplies: analysis.suggestedReplies,
    });
  }

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", buildLlmOnlySystemPrompt()],
    ["human", "{question}"],
  ]);

  const response = await invokePromptWithLlmFallback(prompt, { question });

  return composeStandaloneAnswerPayload(extractMessageText((response as { content?: unknown }).content), [], {
    intent: analysis.intent,
    state: analysis.state,
    suggestedReplies: analysis.suggestedReplies,
  });
}
