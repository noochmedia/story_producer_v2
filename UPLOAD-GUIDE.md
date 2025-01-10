# Upload Guide for GitHub Website

## Steps to Upload

1. Go to your GitHub repository in your web browser

2. Upload these files to their respective folders:

### In `/lib` folder
Navigate into the lib folder and upload:
- openrouter-client.ts
- types.ts
- interactive-search.ts
- chunked-processing.ts

### In `/app/api` folder
Navigate into app/api and upload:
- chat/route.ts
- upload/route.ts

### In `/components` folder
Navigate into components and upload:
- sources.tsx (updated with multiple file upload)

### In `/docs` folder
Create a new docs folder and upload:
- openrouter-setup.md

### In root folder
Upload directly to the main page:
- .env.local.example

## Skip These Folders
- ❌ /node_modules
- ❌ /.next
- ❌ /public
- ❌ /app/api/sources
- ❌ /app/api/project-details
- ❌ /styles

## After Upload
1. Go to Vercel project settings
2. Add OPENROUTER_API_KEY environment variable
3. Trigger a new deployment

## New Features Added
- OpenRouter integration for handling large content
- Interactive search with chunked processing
- Multiple file upload support
- Better error handling and logging

## Testing After Deployment
1. Try uploading multiple files at once
2. Test the OpenRouter integration with a large content query
3. Try the interactive search feature
