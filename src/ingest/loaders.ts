import { PDFParse } from "pdf-parse";

import type { SeedSource, SourceDocument } from "../types/documents.js";
import { normalizeWhitespace } from "../utils/text.js";
import { normalizeHtmlToText } from "./normalize.js";

export async function loadSource(source: SeedSource): Promise<SourceDocument> {
  const response = await fetch(source.url);

  if (!response.ok) {
    throw new Error(`Failed to download source ${source.url}: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const sourceType = source.type ?? (contentType.includes("pdf") ? "pdf" : "html");

  if (sourceType === "pdf") {
    const buffer = Buffer.from(await response.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();

    return {
      url: source.url,
      title: source.title ?? source.url,
      text: normalizeWhitespace(parsed.text),
      sourceType,
      tags: source.tags ?? [],
    };
  }

  const html = await response.text();
  const normalized = normalizeHtmlToText(html);

  return {
    url: source.url,
    title: source.title ?? normalized.title,
    text: normalized.text,
    sourceType,
    tags: source.tags ?? [],
  };
}
