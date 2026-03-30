export interface SeedSource {
  url: string;
  title?: string;
  type?: "html" | "pdf";
  tags?: string[];
  priority?: number;
  benefitId?: string;
  family?: string;
  lifecycle?: string;
  sourceKind?: string;
  requiresAuth?: boolean;
  supportsSms?: boolean;
  formCodes?: string[];
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
  benefitId?: string;
  family?: string;
  lifecycle?: string;
  sourceKind?: string;
  requiresAuth?: boolean;
  supportsSms?: boolean;
  formCodes?: string[];
}

export interface ChunkMetadata {
  url: string;
  title: string;
  sourceType: string;
  chunkIndex: number;
  tags: string[];
  priority: number;
  searchText?: string;
  benefitId?: string;
  family?: string;
  lifecycle?: string;
  sourceKind?: string;
  requiresAuth?: boolean;
  supportsSms?: boolean;
  formCodes?: string[];
}

export interface RetrievedChunk {
  pageContent: string;
  score: number;
  rerankScore?: number;
  metadata: ChunkMetadata;
}
