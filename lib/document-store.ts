import { VercelEmbeddings } from './vercel-embeddings';
import { list, put, del } from '@vercel/blob';

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
  private embeddings?: VercelEmbeddings;
  private initialized: boolean = false;

  private constructor() {
    // Embeddings will be initialized in loadDocuments
  }

  static async getInstance(): Promise<DocumentStore> {
    if (!this.instance) {
      this.instance = new DocumentStore();
      await this.instance.loadDocuments();
    }
    return this.instance;
  }

  private async loadDocuments() {
    if (this.initialized) return;

    try {
      // Initialize embeddings
      this.embeddings = await VercelEmbeddings.getInstance();

      // List all blobs with our index prefix
      const { blobs } = await list({ prefix: 'documents/' });
      
      // Load each document's metadata and embedding
      const loadPromises = blobs.map(async blob => {
        try {
          const response = await fetch(blob.url);
          const doc = await response.json() as Document;
          return doc;
        } catch (error) {
          console.error(`Error loading document from ${blob.url}:`, error);
          return null;
        }
      });

      const docs = await Promise.all(loadPromises);
      this.documents = docs.filter((doc): doc is Document => doc !== null);
      
      console.log(`Loaded ${this.documents.length} documents from Blob storage`);
      this.initialized = true;
    } catch (error) {
      console.error('Error loading documents:', error);
      this.documents = [];
      this.initialized = true;
    }
  }

  private async saveDocument(doc: Document) {
    try {
      // Store the full document (including content and embedding) in Blob
      const blob = await put(`documents/${doc.id}.json`, JSON.stringify(doc), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false
      });
      console.log(`Saved document ${doc.id} to Blob storage:`, blob.url);
    } catch (error) {
      console.error('Error saving document:', error);
      throw error;
    }
  }

  async addDocument(content: string, metadata: Document['metadata']): Promise<Document> {
    try {
      // Generate embedding for the document
      if (!this.embeddings) {
        throw new Error('Embeddings not initialized');
      }
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

      // Save to Blob storage
      await this.saveDocument(document);

      // Add to in-memory cache
      this.documents.push(document);

      return document;
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  }

  async searchSimilar(query: string, filter?: Partial<Document['metadata']>, topK: number = 5): Promise<Document[]> {
    try {
      console.log('Starting document search:', {
        query,
        filter,
        topK
      });

      // Ensure documents are loaded
      await this.loadDocuments();
      console.log('Documents loaded:', {
        totalDocuments: this.documents.length
      });

      // Filter documents if filter provided
      let filteredDocs = this.documents;
      if (filter) {
        filteredDocs = this.documents.filter(doc => 
          Object.entries(filter).every(([key, value]) => 
            doc.metadata[key] === value
          )
        );
        console.log('Documents filtered:', {
          beforeCount: this.documents.length,
          afterCount: filteredDocs.length,
          filter
        });
      }

      // Validate embeddings initialization
      if (!this.embeddings) {
        console.error('Embeddings not initialized');
        throw new Error('Embeddings not initialized');
      }

      // Prepare documents for similarity search
      console.log('Preparing documents for similarity search...');
      const searchDocs = filteredDocs.map(doc => ({
        content: doc.content,
        embedding: doc.embedding
      }));

      // Search for similar documents
      console.log('Performing similarity search...');
      const results = await this.embeddings.searchSimilar(
        query,
        searchDocs,
        topK
      );

      // Map back to full documents with scores
      console.log('Mapping search results to documents...');
      const documents = results.map(result => {
        const doc = filteredDocs.find(d => d.content === result.content);
        if (!doc) {
          console.error('Document not found for search result:', {
            content: result.content.substring(0, 100) + '...',
            score: result.score
          });
          throw new Error('Document not found');
        }
        return {
          ...doc,
          metadata: {
            ...doc.metadata,
            score: result.score
          }
        };
      });

      console.log('Search complete:', {
        query,
        totalResults: documents.length,
        topScore: documents[0]?.metadata.score,
        bottomScore: documents[documents.length - 1]?.metadata.score
      });

      return documents;
    } catch (error) {
      console.error('Error in searchSimilar:', {
        error,
        query,
        filter,
        documentsLoaded: this.documents.length,
        embeddingsInitialized: !!this.embeddings
      });
      throw error;
    }
  }

  async getDocuments(filter?: Partial<Document['metadata']>): Promise<Document[]> {
    // Ensure documents are loaded
    await this.loadDocuments();

    if (!filter) return this.documents;

    return this.documents.filter(doc =>
      Object.entries(filter).every(([key, value]) =>
        doc.metadata[key] === value
      )
    );
  }

  async deleteDocument(id: string): Promise<boolean> {
    try {
      // Delete from Blob storage
      await del(`documents/${id}.json`);

      // Remove from in-memory cache
      const index = this.documents.findIndex(doc => doc.id === id);
      if (index === -1) return false;

      this.documents.splice(index, 1);
      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  async deleteDocuments(filter: Partial<Document['metadata']>): Promise<number> {
    const docsToDelete = this.documents.filter(doc =>
      Object.entries(filter).every(([key, value]) =>
        doc.metadata[key] === value
      )
    );

    const deletePromises = docsToDelete.map(doc => this.deleteDocument(doc.id));
    const results = await Promise.all(deletePromises);
    return results.filter(success => success).length;
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

      // Clear existing documents
      await Promise.all(this.documents.map(doc => this.deleteDocument(doc.id)));

      // Import new documents
      await Promise.all(documents.map(doc => this.saveDocument(doc)));

      // Reload documents
      await this.loadDocuments();
    } catch (error) {
      console.error('Error importing documents:', error);
      throw error;
    }
  }
}

export default DocumentStore;
