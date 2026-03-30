import type { AnswerPayload } from "../types/answers.js";
import type { RetrievedChunk } from "../types/documents.js";

import { dedupeBy, normalizeSearchText, normalizeWhitespace, tokenizeSearchText } from "../utils/text.js";
import { buildLegalNotice, buildSourcesSection, getAnswerSources } from "./formatter.js";

function tokenizeQuestion(question: string): string[] {
  return tokenizeSearchText(question);
}

function scoreLine(line: string, questionTokens: string[]): number {
  const normalizedLine = normalizeSearchText(line);

  let score = 0;
  for (const token of questionTokens) {
    if (normalizedLine.includes(token)) {
      score += 1;
    }
  }

  if (line.startsWith("#")) {
    score += 0.5;
  }

  if (line.startsWith("- ")) {
    score += 0.25;
  }

  return score;
}

function extractCandidateLines(chunks: RetrievedChunk[], question: string): string[] {
  const questionTokens = tokenizeQuestion(question);

  const candidates = chunks.flatMap((chunk) =>
    chunk.pageContent
      .split("\n")
      .map((line) => normalizeWhitespace(line))
      .filter((line) => line.length >= 25 && line.length <= 240)
      .map((line) => ({
        line,
        score: scoreLine(line, questionTokens) + (chunk.rerankScore ?? chunk.score),
      })),
  );

  return dedupeBy(
    candidates
      .sort((left, right) => right.score - left.score)
      .map((item) => item.line),
    (line) => line,
  ).slice(0, 4);
}

export function buildRetrievalOnlyAnswer(question: string, chunks: RetrievedChunk[]): AnswerPayload {
  const lines = extractCandidateLines(chunks, question);
  const sources = getAnswerSources(chunks);
  const legalNotice = buildLegalNotice();
  const body = [
    "He encontrado informacion oficial relacionada, aunque ahora mismo la generacion avanzada no esta disponible.",
    "Resumen automatico basado en el contenido recuperado:",
    ...lines.map((line) => `- ${line.replace(/^[-#\s]+/, "")}`),
  ].join("\n");

  return {
    text: [body, buildSourcesSection(sources, false), legalNotice].filter(Boolean).join("\n\n"),
    sources,
    summary: "He encontrado informacion oficial relacionada, aunque ahora mismo la generacion avanzada no esta disponible.",
    keyPoints: lines.map((line) => line.replace(/^[-#\s]+/, "")).slice(0, 5),
    legalNotice,
  };
}

export function isRetriableGenerationError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { status?: number; message?: string };
  const message = candidate.message?.toLowerCase() ?? "";

  return candidate.status === 429 || message.includes("quota") || message.includes("rate limit");
}
