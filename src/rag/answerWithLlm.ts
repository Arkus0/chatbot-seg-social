import { ChatPromptTemplate } from "@langchain/core/prompts";

import { getChatModel } from "../providers/llm.js";
import { extractMessageText } from "../utils/text.js";
import { buildLegalNotice } from "./formatter.js";

function buildLlmOnlySystemPrompt(): string {
  return [
    "Eres un asistente informativo sobre la Seguridad Social española.",
    "No inventes leyes ni procedimientos.",
    "Si no estás seguro de un dato, dilo claramente.",
    "No des asesoramiento jurídico personalizado.",
    "Responde de forma breve y prudente.",
  ].join("\n");
}

export async function answerWithLlm(question: string): Promise<string> {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", buildLlmOnlySystemPrompt()],
    ["human", "{question}"],
  ]);

  const chain = prompt.pipe(getChatModel());
  const response = await chain.invoke({ question });

  return [extractMessageText(response.content), buildLegalNotice()].filter(Boolean).join("\n\n");
}
