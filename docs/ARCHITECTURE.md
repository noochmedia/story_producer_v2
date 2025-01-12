# Story Producer v2 Architecture

## Overview
Story Producer is a Next.js application that enables AI-powered analysis of source materials. It combines document storage, vector embeddings, and AI chat capabilities to provide intelligent insights from uploaded documents.

## Tech Stack

### Core Technologies
- **Framework**: Next.js 14
- **Language**: TypeScript
- **UI**: React with Tailwind CSS
- **Styling**: Radix UI components with shadcn/ui

### Services
1. **Vercel**
   - Hosting and deployment
   - Blob Storage for documents
   - Edge Functions for API routes

2. **OpenAI**
   - GPT-4 for chat and analysis
   - text-embedding-3-small for document embeddings

## Architecture Components

### Document Management
- **Storage**: Vercel Blob
  - Location: `lib/document-store.ts`
  - Handles document storage and retrieval
  - Maintains metadata and embeddings

### Vector Search
- **Embeddings**: OpenAI
  - Location: `lib/vercel-embeddings.ts`
  - Generates embeddings for documents
  - Performs similarity search using cosine similarity

### Chat System
- **AI Integration**: OpenAI
  - Location: `lib/ai-config.ts`
  - Manages chat configurations
  - Handles streaming responses

## API Routes

### Document Management
- `POST /api/upload`
  - Handles file uploads
  - Generates embeddings
  - Stores in Blob storage

- `GET /api/sources`
  - Lists available documents
  - Returns metadata and status

- `GET /api/sources/view`
  - Retrieves document content
  - Handles file viewing

### Chat Interface
- `POST /api/chat`
  - Processes chat messages
  - Supports deep dive mode
  - Streams AI responses

## Key Components

### Document Store
```typescript
class DocumentStore {
  // Singleton instance for document management
  // Handles:
  // - Document storage
  // - Embedding generation
  // - Similarity search
  // - CRUD operations
}
```

### Embeddings Service
```typescript
class VercelEmbeddings {
  // Manages document embeddings
  // Features:
  // - Embedding generation
  // - Vector similarity search
  // - Cosine similarity calculations
}
```

### Interactive Search
```typescript
// Handles deep dive analysis:
// - Source categorization
// - Theme analysis
// - Quote extraction
// - Follow-up suggestions
```

## Data Flow

1. **Document Upload**
   ```
   Client -> Upload API -> Document Store -> Blob Storage
                      -> Embeddings Service -> Vector Storage
   ```

2. **Search & Analysis**
   ```
   Query -> Document Store -> Vector Search -> Relevant Documents
        -> AI Analysis -> Streaming Response -> Client
   ```

3. **Chat Interaction**
   ```
   User Message -> Chat API -> AI Processing -> Document Search
                           -> Response Generation -> Streaming
   ```

## Environment Configuration

### Required Variables
```env
# OpenAI Configuration
OPENAI_API_KEY=

# Vercel Blob Configuration
BLOB_READ_WRITE_TOKEN=
```

### Optional Features
```env
# OpenRouter for large content (optional)
OPENROUTER_API_KEY=
```

## Deployment

### Prerequisites
1. Vercel account
2. OpenAI API key
3. Blob storage configuration

### Setup Steps
1. Clone repository
2. Install dependencies
3. Configure environment variables
4. Deploy to Vercel

## Features

### Document Analysis
- File upload and processing
- Vector embeddings generation
- Similarity search
- Content extraction

### AI Capabilities
- Deep dive analysis
- Theme identification
- Quote extraction
- Context-aware responses

### User Interface
- Real-time chat
- Document management
- Source viewing
- Progress tracking

## Security

### Data Protection
- Secure document storage
- API key protection
- Environment variable management

### Access Control
- Public/private file handling
- API route protection
- Token validation

## Performance Considerations

### Optimization
- In-memory vector operations
- Streaming responses
- Efficient document loading

### Scalability
- Singleton pattern for services
- Blob storage for documents
- Stateless API routes

## Error Handling

### Robust Error Management
- Detailed error logging
- User-friendly messages
- Fallback mechanisms

### Recovery Procedures
- Document reload capability
- Connection retry logic
- Graceful degradation

## Future Enhancements

### Potential Improvements
1. Document chunking for large files
2. Advanced search capabilities
3. Backup/restore functionality
4. Enhanced monitoring

### Planned Features
1. Multi-user support
2. Advanced analytics
3. Custom embedding models
4. Enhanced UI/UX

## Maintenance

### Regular Tasks
1. Monitor error logs
2. Update dependencies
3. Backup verification
4. Performance monitoring

### Troubleshooting
1. Check environment variables
2. Verify service connections
3. Review error logs
4. Test core functionality
