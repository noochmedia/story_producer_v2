# Setting up OpenRouter

OpenRouter is used to handle large content that exceeds OpenAI's token limits. It provides access to models like Claude-2 with 100k token context windows.

## Getting an API Key

1. Go to [OpenRouter](https://openrouter.ai)
2. Sign up for an account
3. Navigate to the dashboard
4. Create a new API key

## Adding to Environment Variables

### Local Development
1. Copy `.env.local.example` to `.env.local`
2. Add your OpenRouter API key:
```
OPENROUTER_API_KEY=your_key_here
```

### Vercel Deployment
1. Go to your project in Vercel
2. Navigate to Settings > Environment Variables
3. Add a new variable:
   - NAME: `OPENROUTER_API_KEY`
   - VALUE: Your OpenRouter API key
4. Save and redeploy

## How It Works

The system automatically switches to OpenRouter when:
1. Content size exceeds 30,000 tokens
2. Large source files need to be analyzed
3. Complex queries require more context

OpenRouter will:
1. Choose the most appropriate model based on content size
2. Default to Claude-2 for maximum context
3. Fall back to OpenAI for smaller queries

## Testing

To test if OpenRouter is working:
1. Enable "Use sources" in the chat interface
2. Ask about a topic that requires analyzing multiple sources
3. The system will automatically use OpenRouter if needed
4. Check the console logs for "Using OpenRouter due to content size"

## Troubleshooting

If you see errors about missing API keys:
1. Verify the key is correctly set in your environment
2. Check the Vercel deployment logs
3. Ensure the key has proper permissions
4. Try redeploying after updating environment variables
