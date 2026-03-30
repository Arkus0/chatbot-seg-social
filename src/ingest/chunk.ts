import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import type { ChunkMetadata, SourceDocument } from "../types/documents.js";

export async function chunkSourceDocument(source: SourceDocument): Promise<Document<ChunkMetadata>[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1200,
    chunkOverlap: 200,
  });

  const chunks = await splitter.splitText(source.text);

  return chunks.map(
    (pageContent, chunkIndex) =>
      new Document<ChunkMetadata>({
        pageContent,
        metadata: {
          url: source.url,
          title: source.title,
          sourceType: source.sourceType,
          chunkIndex,
          tags: source.tags,
          priority: source.priority,
        },
      }),
  );
}
