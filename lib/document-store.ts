import { VercelEmbeddings } from './vercel-embeddings';

interface Document {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    fileName: string;
    fileType: string;
    type: string;
    uploadedAt: string;
    [key: string]: any;
  };
}

export class DocumentStore {
  private static instance: DocumentStore;
  private documents: Document[] = [];
  private embeddings: VercelEmbeddings;

  private constructor() {
    this.embeddings = VercelEmbeddings.getInstance();
  }

  static getInstance(): DocumentStore {
    if (!this.instance) {
      this.instance = new DocumentStore();
    }
    return this.instance;
  }

  async addDocument(content: string, metadata: Document['metadata']): Promise<Document> {
    try {
      // Generate embedding for the document
      const embedding = await this.embeddings.generateEmbedding(content);

      // Create document with unique ID
      const document: Document = {
        id: `${metadata.fileName}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        content,
        embedding,
        metadata: {
          ...metadata,
          uploadedAt: metadata.uploadedAt || new Date().toISOString()
        }
      };

      // Store the document
      this.documents.push(document);

      return document;
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  }

  async searchSimilar(query: string, filter?: Partial<Document['metadata']>, topK: number = 5): Promise<Document[]> {
    try {
      // Filter documents if filter provided
      let filteredDocs = this.documents;
      if (filter) {
        filteredDocs = this.documents.filter(doc => 
          Object.entries(filter).every(([key, value]) => 
            doc.metadata[key] === value
          )
        );
      }

      // Search for similar documents
      const results = await this.embeddings.searchSimilar(
        query,
        filteredDocs.map(doc => ({
          content: doc.content,
          embedding: doc.embedding
        })),
        topK
      );

      // Map back to full documents
      return results.map(result => {
        const doc = filteredDocs.find(d => d.content === result.content);
        if (!doc) throw new Error('Document not found');
        return doc;
      });
    } catch (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
  }

  getDocuments(filter?: Partial<Document['metadata']>): Document[] {
    if (!filter) return this.documents;

    return this.documents.filter(doc =>
      Object.entries(filter).every(([key, value]) =>
        doc.metadata[key] === value
      )
    );
  }

  deleteDocument(id: string): boolean {
    const index = this.documents.findIndex(doc => doc.id === id);
    if (index === -1) return false;

    this.documents.splice(index, 1);
    return true;
  }

  deleteDocuments(filter: Partial<Document['metadata']>): number {
    const initialLength = this.documents.length;
    this.documents = this.documents.filter(doc =>
      !Object.entries(filter).every(([key, value]) =>
        doc.metadata[key] === value
      )
    );
    return initialLength - this.documents.length;
  }

  // For persistence
  exportDocuments(): string {
    return JSON.stringify(this.documents);
  }

  importDocuments(jsonData: string) {
    try {
      const documents = JSON.parse(jsonData);
      if (!Array.isArray(documents)) {
        throw new Error('Invalid document data');
      }
      this.documents = documents;
    } catch (error) {
      console.error('Error importing documents:', error);
      throw error;
    }
  }
}

export default DocumentStore;
