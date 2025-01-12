# Story Producer v2 Troubleshooting Guide

## Common Issues and Solutions

### Vector Search Issues

#### Issue: TypeError: t.searchSimilar is not a function
**Symptoms:**
- Error in deep dive mode
- Search functionality not working
- TypeError about searchSimilar

**Solution:**
1. Check embeddings initialization:
   ```typescript
   // Ensure proper initialization in document-store.ts
   static async getInstance(): Promise<DocumentStore> {
     if (!this.instance) {
       this.instance = new DocumentStore();
       // Initialize embeddings first
       this.instance.embeddings = await VercelEmbeddings.getInstance();
       // Then load documents
       await this.instance.loadDocuments();
     }
     return this.instance;
   }
   ```

2. Verify OpenAI API key:
   ```typescript
   // Add explicit check in chat route
   if (!process.env.OPENAI_API_KEY) {
     throw new Error('OpenAI API key not configured');
   }
   ```

3. Check embeddings class export:
   ```typescript
   // Proper export in vercel-embeddings.ts
   export class VercelEmbeddings {
     // ... implementation
   }
   export default VercelEmbeddings;
   ```

### Storage Issues

#### Issue: Document Storage Errors with Vercel KV/Postgres
**Symptoms:**
- Storage-related errors
- Database connection issues
- Missing environment variables

**Solution:**
1. Switch to Blob storage:
   ```typescript
   // Use Vercel Blob for document storage
   import { put, del, list } from '@vercel/blob';

   // Store document
   const blob = await put(`documents/${doc.id}.json`, JSON.stringify(doc), {
     access: 'public',
     contentType: 'application/json',
     addRandomSuffix: false
   });
   ```

2. Configure Blob token:
   ```env
   BLOB_READ_WRITE_TOKEN=your_blob_token
   ```

### Initialization Issues

#### Issue: Embeddings Not Initialized
**Symptoms:**
- "Embeddings not initialized" error
- Search functionality failing
- Undefined embeddings object

**Solution:**
1. Add initialization check:
   ```typescript
   private async loadDocuments() {
     if (this.initialized) return;

     try {
       // Ensure embeddings are initialized
       if (!this.embeddings) {
         this.embeddings = await VercelEmbeddings.getInstance();
       }
       // ... rest of initialization
     } catch (error) {
       console.error('Error loading documents:', error);
       throw error;
     }
   }
   ```

2. Add error logging:
   ```typescript
   console.log('Document store initialized:', {
     hasEmbeddings: store !== null,
     hasSearchSimilar: typeof store.searchSimilar === 'function'
   });
   ```

### Deep Dive Mode Issues

#### Issue: Source Analysis Failing
**Symptoms:**
- No sources found
- Analysis not starting
- Empty responses

**Solution:**
1. Add comprehensive error handling:
   ```typescript
   try {
     const sources = await store.searchSimilar(query, { type: 'source' });
     console.log('Search completed successfully');

     if (!sources.length) {
       console.log('No relevant sources found');
       return;
     }

     // Log found sources
     console.log('Found sources:', sources.map(doc => ({
       id: doc.id,
       fileName: doc.metadata.fileName,
       score: doc.metadata.score,
       contentPreview: doc.content.substring(0, 100) + '...'
     })));
   } catch (error) {
     console.error('Error in deep dive mode:', {
       error,
       message: error instanceof Error ? error.message : 'Unknown error',
       stack: error instanceof Error ? error.stack : undefined
     });
   }
   ```

### Environment Issues

#### Issue: Missing Environment Variables
**Symptoms:**
- API calls failing
- Storage operations failing
- Initialization errors

**Solution:**
1. Check required variables:
   ```env
   # Required
   OPENAI_API_KEY=your_openai_key
   BLOB_READ_WRITE_TOKEN=your_blob_token

   # Optional
   OPENROUTER_API_KEY=your_openrouter_key  # for large content
   ```

2. Verify in code:
   ```typescript
   if (!process.env.OPENAI_API_KEY) {
     throw new Error('OpenAI API key not configured');
   }
   ```

## Debugging Steps

### 1. Check Initialization
```typescript
// Add logging to getInstance
static async getInstance(): Promise<DocumentStore> {
  console.log('Getting document store instance...');
  // ... implementation
  console.log('Document store initialized');
}
```

### 2. Verify Document Loading
```typescript
// Add logging to loadDocuments
private async loadDocuments() {
  console.log('Loading documents...');
  // ... implementation
  console.log(`Loaded ${this.documents.length} documents`);
}
```

### 3. Monitor Search Operations
```typescript
// Add logging to searchSimilar
async searchSimilar(query: string, filter?: Partial<Document['metadata']>) {
  console.log('Starting search:', { query, filter });
  // ... implementation
  console.log('Search complete:', { results: documents.length });
}
```

## Recovery Procedures

### 1. Reset Document Store
```typescript
// Clear documents and reinitialize
await Promise.all(this.documents.map(doc => this.deleteDocument(doc.id)));
this.initialized = false;
await this.loadDocuments();
```

### 2. Verify Blob Storage
```typescript
// List all stored documents
const { blobs } = await list({ prefix: 'documents/' });
console.log('Stored documents:', blobs.length);
```

### 3. Test Embeddings
```typescript
// Test embedding generation
const embedding = await this.embeddings.generateEmbedding('test');
console.log('Embedding generated:', embedding.length);
```

## Monitoring

### 1. Error Tracking
- Check console logs for detailed error messages
- Monitor initialization status
- Track API responses

### 2. Performance Monitoring
- Document load times
- Search response times
- API latency

### 3. Storage Monitoring
- Blob storage usage
- Document count
- Embedding sizes
