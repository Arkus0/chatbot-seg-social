import type { RetrievedChunk } from "../types/documents.js";

import { dedupeBy, normalizeWhitespace, truncateText } from "../utils/text.js";

export function formatRetrievedChunks(chunks: RetrievedChunk[], maxContextChars: number): string {
  const lines: string[] = [];
  let currentLength = 0;

  for (const [index, chunk] of chunks.entries()) {
    const block = [
      `[Fuente ${index + 1}]`,
      `Título: ${chunk.metadata.title}`,
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

export function buildNoContextAnswer(): string {
  return [
    "No tengo contexto oficial suficiente para responder con seguridad a esa pregunta.",
    "",
    "Consulta la web oficial o la sede electrónica de la Seguridad Social para confirmarlo.",
    "",
    buildLegalNotice(),
  ].join("\n");
}

export function buildLegalNotice(): string {
  return "Aviso legal: esta respuesta es informativa y no sustituye la información oficial publicada por la Seguridad Social ni el asesoramiento jurídico profesional.";
}

export function buildSourcesSection(chunks: RetrievedChunk[]): string {
  const sources = dedupeBy(chunks, (chunk) => `${chunk.metadata.url}#${chunk.metadata.chunkIndex}`).slice(0, 3);

  if (sources.length === 0) {
    return "";
  }

  return [
    "Fuentes oficiales:",
    ...sources.map((chunk, index) => `${index + 1}. ${chunk.metadata.title} - ${chunk.metadata.url}`),
  ].join("\n");
}

export function composeTelegramAnswer(answer: string, chunks: RetrievedChunk[]): string {
  const body = truncateText(normalizeWhitespace(answer), 2600);
  const sources = buildSourcesSection(chunks);

  return [body, sources, buildLegalNotice()].filter(Boolean).join("\n\n");
}
