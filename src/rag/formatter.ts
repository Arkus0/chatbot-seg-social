import type { AnswerPayload, AnswerSource } from "../types/answers.js";
import type { RetrievedChunk } from "../types/documents.js";

import { dedupeBy, normalizeWhitespace, truncateText } from "../utils/text.js";

interface StructuredAnswerContent {
  summary: string;
  keyPoints: string[];
  body: string;
}

const MAX_KEY_POINTS = 5;

function isBulletLine(line: string): boolean {
  return /^([-*]|\d+\.)\s+/.test(line);
}

function toBulletText(line: string): string {
  return line.replace(/^([-*]|\d+\.)\s+/, "").trim();
}

function extractStructuredContent(answer: string): StructuredAnswerContent {
  const body = truncateText(normalizeWhitespace(answer), 2600);
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const keyPoints = dedupeBy(
    lines.filter(isBulletLine).map(toBulletText),
    (line) => line.toLowerCase(),
  ).slice(0, MAX_KEY_POINTS);
  const summary =
    lines.find((line) => !isBulletLine(line) && !/^fuentes oficiales:?$/i.test(line) && !/^aviso legal:?$/i.test(line)) ??
    "No tengo contexto oficial suficiente para responder con seguridad a esa pregunta.";

  return {
    summary,
    keyPoints,
    body,
  };
}

export function formatRetrievedChunks(chunks: RetrievedChunk[], maxContextChars: number): string {
  const lines: string[] = [];
  let currentLength = 0;

  for (const [index, chunk] of chunks.entries()) {
    const block = [
      `Fuente ${index + 1}`,
      `Titulo: ${chunk.metadata.title}`,
      `URL: ${chunk.metadata.url}`,
      `Contenido: ${normalizeWhitespace(chunk.pageContent)}`,
    ].join("\n");

    if (currentLength + block.length > maxContextChars) {
      break;
    }

    lines.push(block);
    currentLength += block.length;
  }

  return lines.join("\n\n");
}

export function buildLegalNotice(): string {
  return "Aviso legal: esta respuesta es informativa y no sustituye la informacion oficial publicada por la Seguridad Social ni el asesoramiento juridico profesional.";
}

export function getAnswerSources(chunks: RetrievedChunk[]): AnswerSource[] {
  return dedupeBy(chunks, (chunk) => chunk.metadata.url)
    .slice(0, 3)
    .map((chunk) => ({
      title: chunk.metadata.title,
      url: chunk.metadata.url,
    }));
}

export function buildSourcesSection(sources: AnswerSource[], includeUrls = true): string {
  if (sources.length === 0) {
    return "";
  }

  return [
    "Fuentes oficiales:",
    ...sources.map((source, index) =>
      includeUrls ? `${index + 1}. ${source.title} - ${source.url}` : `${index + 1}. ${source.title}`,
    ),
  ].join("\n");
}

export function composeAnswerPayload(answer: string, chunks: RetrievedChunk[]): AnswerPayload {
  const structured = extractStructuredContent(answer);
  const sources = getAnswerSources(chunks);
  const legalNotice = buildLegalNotice();

  return {
    text: [structured.body, buildSourcesSection(sources, false), legalNotice].filter(Boolean).join("\n\n"),
    sources,
    summary: structured.summary,
    keyPoints: structured.keyPoints,
    legalNotice,
  };
}

export function composeStandaloneAnswerPayload(answer: string, sources: AnswerSource[] = []): AnswerPayload {
  const structured = extractStructuredContent(answer);
  const legalNotice = buildLegalNotice();

  return {
    text: [structured.body, buildSourcesSection(sources, false), legalNotice].filter(Boolean).join("\n\n"),
    sources,
    summary: structured.summary,
    keyPoints: structured.keyPoints,
    legalNotice,
  };
}

export function composeCliAnswer(answer: string, chunks: RetrievedChunk[]): string {
  const structured = extractStructuredContent(answer);
  const sources = getAnswerSources(chunks);

  return [structured.body, buildSourcesSection(sources, true), buildLegalNotice()].filter(Boolean).join("\n\n");
}

export function buildNoContextAnswer(): string {
  return [
    "No tengo contexto oficial suficiente para responder con seguridad a esa pregunta.",
    "",
    "Consulta la web oficial o la sede electronica de la Seguridad Social para confirmarlo.",
    "",
    buildLegalNotice(),
  ].join("\n");
}

export function buildNoContextAnswerPayload(): AnswerPayload {
  const text = buildNoContextAnswer();

  return {
    text,
    sources: [],
    summary: "No tengo contexto oficial suficiente para responder con seguridad a esa pregunta.",
    keyPoints: [],
    legalNotice: buildLegalNotice(),
  };
}
