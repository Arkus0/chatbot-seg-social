import { Pinecone } from "@pinecone-database/pinecone";

import { getEnv } from "../src/config/env.js";
import { getEmbeddings } from "../src/rag/embeddings.js";
import { getChatModel } from "../src/providers/llm.js";
import { extractMessageText } from "../src/utils/text.js";

async function main(): Promise<void> {
  const env = getEnv();
  const embeddings = getEmbeddings();

  const [chatReplyResult, queryEmbeddingResult, documentEmbeddingResult, indexesResult] = await Promise.allSettled([
    getChatModel().invoke("Responde solo con OK"),
    embeddings.embedQuery("prueba seguridad social"),
    embeddings.embedDocuments(["prestación de jubilación contributiva"]),
    new Pinecone({ apiKey: env.PINECONE_API_KEY! }).listIndexes(),
  ]);

  console.log(
    JSON.stringify(
      {
        llmProvider: env.LLM_PROVIDER,
        llmReply:
          chatReplyResult.status === "fulfilled" ? extractMessageText(chatReplyResult.value.content).trim() : null,
        llmError: chatReplyResult.status === "rejected" ? String(chatReplyResult.reason) : null,
        embeddingModel: env.EMBEDDING_MODEL,
        queryEmbeddingLength:
          queryEmbeddingResult.status === "fulfilled" ? queryEmbeddingResult.value.length : 0,
        queryEmbeddingError: queryEmbeddingResult.status === "rejected" ? String(queryEmbeddingResult.reason) : null,
        documentEmbeddingLength:
          documentEmbeddingResult.status === "fulfilled" ? (documentEmbeddingResult.value[0]?.length ?? 0) : 0,
        documentEmbeddingError:
          documentEmbeddingResult.status === "rejected" ? String(documentEmbeddingResult.reason) : null,
        pineconeIndexes:
          indexesResult.status === "fulfilled" ? indexesResult.value.indexes?.map((index) => index.name) ?? [] : [],
        pineconeError: indexesResult.status === "rejected" ? String(indexesResult.reason) : null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
