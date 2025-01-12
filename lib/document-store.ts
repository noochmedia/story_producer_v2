import { VercelEmbeddings } from './vercel-embeddings';
import fs from 'fs';
import path from 'path';

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
  private storePath: string;

  private constructor() {
    this.embeddings = VercelEmbeddings.getInstance();
    this.storePath = path.join(process.cwd(), 'data', 'documents.json');
    this.loadDocuments();
  }

  static getInstance(): DocumentStore {
    if (!this.instance) {
      this.instance = new DocumentStore();
    }
    return this.instance;
  }

  private loadDocuments() {
    try {
      // Ensure data directory exists
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Load documents if file exists
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf-8');
        this.documents = JSON.parse(data);
        console.log(`Loaded ${this.documents.length} documents from storage`);
      } else {
        console.log('No existing documents found');
        this.documents = [];
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      this.documents = [];
    }
  }

  private saveDocuments() {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.documents, null, 2));
      console.log(`Saved ${this.documents.length} documents to storage`);
    } catch (error) {
      console.error('Error saving documents:', error);
      throw error;
    }
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

      // Save to disk
      this.saveDocuments();

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

      // Map back to full documents with scores
      return results.map(result => {
        const doc = filteredDocs.find(d => d.content === result.content);
        if (!doc) throw new Error('Document not found');
        return {
          ...doc,
          metadata: {
            ...doc.metadata,
            score: result.score
          }
        };
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
    this.saveDocuments();
    return true;
  }

  deleteDocuments(filter: Partial<Document['metadata']>): number {
    const initialLength = this.documents.length;
    this.documents = this.documents.filter(doc =>
      !Object.entries(filter).every(([key, value]) =>
        doc.metadata[key] === value
      )
    );
    const deletedCount = initialLength - this.documents.length;
    if (deletedCount > 0) {
      this.saveDocuments();
    }
    return deletedCount;
  }

  // For backup/restore
  exportDocuments(): string {
    return JSON.stringify(this.documents, null, 2);
  }

  importDocuments(jsonData: string) {
    try {
      const documents = JSON.parse(jsonData);
      if (!Array.isArray(documents)) {
        throw new Error('Invalid document data');
      }
      this.documents = documents;
      this.saveDocuments();
    } catch (error) {
      console.error('Error importing documents:', error);
      throw error;
    }
  }
}

export default DocumentStore;
