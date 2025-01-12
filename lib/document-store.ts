import { VercelEmbeddings } from './vercel-embeddings';
import { kv } from '@vercel/kv';

export interface Document {
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
  private readonly DOCUMENTS_KEY = 'documents';

  private constructor() {
    this.embeddings = VercelEmbeddings.getInstance();
  }

  static async getInstance(): Promise<DocumentStore> {
    if (!this.instance) {
      this.instance = new DocumentStore();
      await this.instance.loadDocuments();
    }
    return this.instance;
  }

  private async loadDocuments() {
    try {
      // Load documents from KV store
      const documents = await kv.get<Document[]>(this.DOCUMENTS_KEY);
      console.log('Raw documents from KV:', documents);

      // Ensure documents is an array
      if (Array.isArray(documents)) {
        this.documents = documents;
        console.log(`Loaded ${this.documents.length} documents from KV store`);
      } else {
        console.log('No valid documents found, initializing empty array');
        this.documents = [];
        // Initialize KV store with empty array
        await kv.set(this.DOCUMENTS_KEY, []);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      this.documents = [];
      // Initialize KV store with empty array on error
      try {
        await kv.set(this.DOCUMENTS_KEY, []);
      } catch (kvError) {
        console.error('Error initializing KV store:', kvError);
      }
    }
  }

  private async saveDocuments() {
    try {
      await kv.set(this.DOCUMENTS_KEY, this.documents);
      console.log(`Saved ${this.documents.length} documents to KV store`);
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

      // Save to KV store
      await this.saveDocuments();

      return document;
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  }

  async searchSimilar(query: string, filter?: Partial<Document['metadata']>, topK: number = 5): Promise<Document[]> {
    try {
      // Ensure documents are loaded
      if (this.documents.length === 0) {
        await this.loadDocuments();
      }

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

  async getDocuments(filter?: Partial<Document['metadata']>): Promise<Document[]> {
    // Ensure documents are loaded
    if (this.documents.length === 0) {
      await this.loadDocuments();
    }

    if (!filter) return this.documents;

    return this.documents.filter(doc =>
      Object.entries(filter).every(([key, value]) =>
        doc.metadata[key] === value
      )
    );
  }

  async deleteDocument(id: string): Promise<boolean> {
    const index = this.documents.findIndex(doc => doc.id === id);
    if (index === -1) return false;

    this.documents.splice(index, 1);
    await this.saveDocuments();
    return true;
  }

  async deleteDocuments(filter: Partial<Document['metadata']>): Promise<number> {
    const initialLength = this.documents.length;
    this.documents = this.documents.filter(doc =>
      !Object.entries(filter).every(([key, value]) =>
        doc.metadata[key] === value
      )
    );
    const deletedCount = initialLength - this.documents.length;
    if (deletedCount > 0) {
      await this.saveDocuments();
    }
    return deletedCount;
  }

  // For backup/restore
  exportDocuments(): string {
    return JSON.stringify(this.documents, null, 2);
  }

  async importDocuments(jsonData: string) {
    try {
      const documents = JSON.parse(jsonData);
      if (!Array.isArray(documents)) {
        throw new Error('Invalid document data');
      }
      this.documents = documents;
      await this.saveDocuments();
    } catch (error) {
      console.error('Error importing documents:', error);
      throw error;
    }
  }
}

export default DocumentStore;
