import { getAnswer } from "../src/rag/getAnswer.js";

async function main(): Promise<void> {
  const question = process.argv.slice(2).join(" ").trim();

  if (!question) {
    throw new Error('Usage: npm run ask -- "tu pregunta"');
  }

  const answer = await getAnswer(question, {
    channel: "web",
  });

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
