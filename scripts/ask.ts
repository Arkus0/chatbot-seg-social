import { getEnv, getRequiredBotMode } from "../src/config/env.js";
import { answerQuestion } from "../src/rag/answerQuestion.js";
import { answerWithLlm } from "../src/rag/answerWithLlm.js";

async function main(): Promise<void> {
  const question = process.argv.slice(2).join(" ").trim();

  if (!question) {
    throw new Error('Usage: npm run ask -- "tu pregunta"');
  }

  const env = getEnv();
  const botMode = getRequiredBotMode(env);
  const answer =
    botMode === "rag"
      ? await answerQuestion(question)
      : botMode === "llm"
        ? await answerWithLlm(question)
        : {
            text: `Eco: ${question}`,
            sources: [],
          };

  console.log(answer.text);

  if (answer.sources.length > 0) {
    console.log("");
    console.log("Enlaces:");
    for (const [index, source] of answer.sources.entries()) {
      console.log(`${index + 1}. ${source.title} - ${source.url}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
