import { ChatPromptTemplate } from "@langchain/core/prompts";

import { getEnv } from "../config/env.js";
import { getChatModel } from "../providers/llm.js";
import { extractMessageText } from "../utils/text.js";
import { buildNoContextAnswer, composeTelegramAnswer, formatRetrievedChunks } from "./formatter.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompt.js";
import { retrieveRelevantChunks } from "./retriever.js";

export async function answerQuestion(question: string): Promise<string> {
  const env = getEnv();
  const retrievedChunks = await retrieveRelevantChunks(question);

  if (retrievedChunks.length === 0) {
    return buildNoContextAnswer();
  }

  const context = formatRetrievedChunks(retrievedChunks, env.MAX_CONTEXT_CHARS);
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", buildSystemPrompt()],
    ["human", "{input}"],
  ]);

  const chain = prompt.pipe(getChatModel());
  const response = await chain.invoke({
    input: buildUserPrompt(question, context),
  });

  return composeTelegramAnswer(extractMessageText(response.content), retrievedChunks);
}
