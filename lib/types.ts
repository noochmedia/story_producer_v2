export type DocumentType = 'source' | 'project_details';

export interface DocumentMetadata {
  fileName: string;
  fileType: string;
  type: DocumentType;
  uploadedAt: string;
  fileUrl?: string;
  filePath?: string;
  hasBlob?: boolean;
}

export interface ChunkMetadata extends DocumentMetadata {
  chunkIndex: number;
  totalChunks: number;
  chunkLength: number;
  content: string;
}
