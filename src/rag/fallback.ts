import type { AnswerPayload, ChatIntent, ChatState } from "../types/answers.js";
import type { RetrievedChunk } from "../types/documents.js";

import { dedupeBy, normalizeSearchText, normalizeWhitespace, tokenizeSearchText } from "../utils/text.js";
import { composeStandaloneAnswerPayload, getAnswerSources } from "./formatter.js";

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

export function buildRetrievalOnlyAnswer(
  question: string,
  chunks: RetrievedChunk[],
  intent: ChatIntent,
  state: ChatState,
  suggestedReplies: string[],
): AnswerPayload {
  const lines = extractCandidateLines(chunks, question);
  const sources = getAnswerSources(chunks);
  const body = [
    "Resumen del caso:",
    state.caseSummary || "Caso abierto con contexto oficial parcial.",
    "",
    "Respuesta breve:",
    "He encontrado informacion oficial relacionada, aunque ahora mismo la generacion avanzada no esta disponible.",
    "",
    "Siguiente paso ahora:",
    ...lines.map((line) => `- ${line.replace(/^[-#\s]+/, "")}`),
    "",
    "Si el INSS te responde o te pide algo:",
    "- Usa Mis expedientes administrativos o la via oficial del tramite para confirmar el detalle exacto antes de presentar nada.",
    "",
    "Alternativas si esta via no encaja:",
    "- Si el detalle practico no queda claro, revisa la fuente oficial enlazada o vuelve con una duda mas concreta del expediente.",
  ].join("\n");

  return composeStandaloneAnswerPayload(
    body,
    sources,
    {
      intent,
      state,
      suggestedReplies,
    },
  );
}

export function isRetriableGenerationError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { status?: number; message?: string };
  const message = candidate.message?.toLowerCase() ?? "";

  return candidate.status === 429 || message.includes("quota") || message.includes("rate limit");
}
