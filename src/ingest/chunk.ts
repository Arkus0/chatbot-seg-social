import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import type { ChunkMetadata, SourceDocument } from "../types/documents.js";
import { truncateText } from "../utils/text.js";

const SEARCH_CONTEXT_START = "<search_context>";
const SEARCH_CONTEXT_END = "</search_context>";

function buildSearchContext(title: string, searchText: string): string {
  const searchHints = truncateText(searchText.trim(), 360);

  if (!searchHints) {
    return "";
  }

  return [
    SEARCH_CONTEXT_START,
    `Documento oficial: ${title}`,
    `Terminos relacionados: ${searchHints}`,
    SEARCH_CONTEXT_END,
  ].join("\n");
}

function injectSearchContext(pageContent: string, title: string, searchText: string): string {
  const prelude = buildSearchContext(title, searchText);

  if (!prelude) {
    return pageContent;
  }

  return `${prelude}\n\n${pageContent}`;
}

export function stripChunkSearchContext(pageContent: string): string {
  return pageContent.replace(/^<search_context>[\s\S]*?<\/search_context>\s*/u, "").trim();
}

export async function chunkSourceDocument(source: SourceDocument): Promise<Document<ChunkMetadata>[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1200,
    chunkOverlap: 200,
  });

  const chunks = await splitter.splitText(source.text);

  return chunks.map(
    (pageContent, chunkIndex) =>
      new Document<ChunkMetadata>({
        pageContent: injectSearchContext(pageContent, source.title, source.searchText),
        metadata: {
          url: source.url,
          title: source.title,
          sourceType: source.sourceType,
          chunkIndex,
          tags: source.tags,
          priority: source.priority,
          searchText: source.searchText,
        },
      }),
  );
}
