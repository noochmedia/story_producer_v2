# Files to Push

## Core Functionality
- [ ] lib/openrouter-client.ts (OpenRouter integration)
- [ ] lib/types.ts (Shared TypeScript types)
- [ ] lib/interactive-search.ts (Interactive search feature)
- [ ] lib/chunked-processing.ts (Content chunking)
- [ ] app/api/chat/route.ts (Updated chat endpoint)

## Documentation
- [ ] docs/openrouter-setup.md (Setup instructions)
- [ ] .env.local.example (Environment variables template)

## Git Commands
```bash
# Stage only the necessary files
git add lib/openrouter-client.ts
git add lib/types.ts
git add lib/interactive-search.ts
git add lib/chunked-processing.ts
git add app/api/chat/route.ts
git add docs/openrouter-setup.md
git add .env.local.example

# Commit with descriptive message
git commit -m "Add OpenRouter integration and interactive search
- Add OpenRouter client for handling large content
- Implement interactive search with chunked processing
- Add documentation and environment setup"

# Push to repository
git push origin main
```

## After Pushing
1. Add OPENROUTER_API_KEY to Vercel environment variables
2. Redeploy the application
3. Test the integration with a large content query
