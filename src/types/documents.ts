export interface SeedSource {
  url: string;
  title?: string;
  type?: "html" | "pdf";
  tags?: string[];
  priority?: number;
  enabled?: boolean;
}

export interface SourceDocument {
  url: string;
  title: string;
  text: string;
  sourceType: "html" | "pdf";
  tags: string[];
  priority: number;
  searchText: string;
}

export interface ChunkMetadata {
  url: string;
  title: string;
  sourceType: string;
  chunkIndex: number;
  tags: string[];
  priority: number;
  searchText?: string;
}

export interface RetrievedChunk {
  pageContent: string;
  score: number;
  rerankScore?: number;
  metadata: ChunkMetadata;
}
