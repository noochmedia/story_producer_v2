# Story Producer v2 Setup Guide

## Quick Start

1. **Clone Repository**
   ```bash
   git clone https://github.com/noochmedia/story_producer_v2.git
   cd story_producer_v2
   ```

2. **Install Dependencies**
   ```bash
   npm install
   # or
   bun install
   ```

3. **Configure Environment**
   ```bash
   cp .env.local.example .env.local
   ```

## Environment Setup

### Required Environment Variables

1. **OpenAI Configuration**
   ```env
   OPENAI_API_KEY=your_openai_key
   ```
   - Get from: https://platform.openai.com/api-keys
   - Required for: Embeddings and chat functionality

2. **Vercel Blob Configuration**
   ```env
   BLOB_READ_WRITE_TOKEN=your_blob_token
   ```
   - Get from: Vercel project settings
   - Required for: Document storage

## Development

1. **Start Development Server**
   ```bash
   npm run dev
   # or
   bun dev
   ```

2. **Access Application**
   - Open: http://localhost:3000
   - Test upload functionality
   - Verify chat interface

## Testing the Setup

1. **Document Upload**
   - Upload a test document
   - Verify in sources list
   - Check blob storage

2. **Chat Functionality**
   - Try regular chat
   - Test deep dive mode
   - Verify source references

3. **Vector Search**
   - Upload multiple documents
   - Test similarity search
   - Verify relevance

## Common Issues

### Upload Issues
- **Problem**: Upload fails
  - Check BLOB_READ_WRITE_TOKEN
  - Verify file size limits
  - Check file type support

### Chat Issues
- **Problem**: Chat not responding
  - Verify OPENAI_API_KEY
  - Check API rate limits
  - Monitor error logs

### Search Issues
- **Problem**: No sources found
  - Check document upload success
  - Verify embeddings generation
  - Check similarity threshold

## Deployment

### Vercel Deployment

1. **Connect Repository**
   ```bash
   vercel link
   ```

2. **Configure Environment**
   ```bash
   vercel env pull
   ```

3. **Deploy**
   ```bash
   vercel deploy
   ```

### Environment Variables on Vercel

1. Add to Vercel Project:
   - OPENAI_API_KEY
   - BLOB_READ_WRITE_TOKEN

2. Redeploy if needed:
   ```bash
   vercel --prod
   ```

## Monitoring

### Local Development
- Check console logs
- Monitor network requests
- Watch for error messages

### Production
- Vercel dashboard
- Error logging
- Performance metrics

## Maintenance

### Regular Tasks
1. Update dependencies
   ```bash
   npm update
   # or
   bun update
   ```

2. Check for errors
   ```bash
   npm run lint
   # or
   bun lint
   ```

### Backup
1. Export documents regularly
2. Monitor blob storage usage
3. Keep environment variables secure

## Support

### Resources
- Architecture Documentation: See ARCHITECTURE.md
- OpenAI Documentation: https://platform.openai.com/docs
- Vercel Documentation: https://vercel.com/docs

### Troubleshooting Steps

1. **System Issues**
   - Check environment variables
   - Verify service connections
   - Review error logs

2. **Performance Issues**
   - Monitor memory usage
   - Check response times
   - Verify embedding operations

3. **Storage Issues**
   - Check blob storage limits
   - Monitor document count
   - Verify file permissions
