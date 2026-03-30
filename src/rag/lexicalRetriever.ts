import { readFile } from "node:fs/promises";

import type { RetrievedChunk } from "../types/documents.js";

import { getEnv } from "../config/env.js";
import { stripChunkSearchContext } from "../ingest/chunk.js";
import { countTokenMatches, tokenizeSearchText } from "../utils/text.js";
import type { RetrievalIntentContext } from "./query.js";
import { expandQuestion, rerankRetrievedChunks } from "./query.js";

interface CachedChunk {
  pageContent: string;
  metadata: RetrievedChunk["metadata"];
}

let fallbackCorpusPromise: Promise<CachedChunk[]> | undefined;

async function loadFallbackCorpus(): Promise<CachedChunk[]> {
  if (!fallbackCorpusPromise) {
    fallbackCorpusPromise = readFile(new URL("../../data/cache/fallback-corpus.json", import.meta.url), "utf8").then(
      (content) => JSON.parse(content) as CachedChunk[],
    );
  }

  return fallbackCorpusPromise;
}

export async function retrieveLexicalFallbackChunks(
  question: string,
  context?: RetrievalIntentContext,
): Promise<RetrievedChunk[]> {
  const env = getEnv();
  const expandedQuestion = expandQuestion(question);
  const questionTokens = tokenizeSearchText(expandedQuestion);
  const corpus = await loadFallbackCorpus();

  const ranked = corpus
    .map((chunk) => {
      const titleMatches = countTokenMatches(questionTokens, chunk.metadata.title);
      const tagMatches = countTokenMatches(questionTokens, chunk.metadata.tags.join(" "));
      const searchMatches = countTokenMatches(
        questionTokens,
        chunk.metadata.searchText ?? `${chunk.metadata.title} ${chunk.metadata.tags.join(" ")}`,
      );
      const contentMatches = countTokenMatches(questionTokens, chunk.pageContent.slice(0, 900));

      const score =
        titleMatches * 0.16 +
        tagMatches * 0.12 +
        searchMatches * 0.18 +
        contentMatches * 0.03 +
        chunk.metadata.priority * 0.02;

      return {
        pageContent: stripChunkSearchContext(chunk.pageContent),
        score,
        metadata: chunk.metadata,
      } satisfies RetrievedChunk;
    })
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(env.RAG_TOP_K * 3, 12));

  if (ranked.length === 0) {
    return [];
  }

  return rerankRetrievedChunks(question, ranked, env.RAG_TOP_K, context);
}
