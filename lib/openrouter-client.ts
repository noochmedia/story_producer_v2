import { ChatMessage } from './types';

interface OpenRouterResponse {
  choices: {
    delta?: {
      content?: string;
    };
    message?: {
      content: string;
    };
    finish_reason?: string;
  }[];
}

interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
}

export class OpenRouterClient {
  private apiKey: string;
  private baseURL = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createChatCompletion(params: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    response_format?: { type: string };
  }) {
    console.log('OpenRouter Request:', {
      model: params.model || 'anthropic/claude-2',
      messageCount: params.messages.length,
      stream: params.stream,
      estimatedTokens: OpenRouterClient.estimateTokens(
        params.messages.map(m => m.content).join('\n')
      )
    });

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/openrouter-dev',
        'X-Title': 'Story Producer'
      },
      body: JSON.stringify({
        ...params,
        model: params.model || 'anthropic/claude-2',
        response_format: { type: "text" }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenRouter Error:', error);
      throw new Error(`OpenRouter API error: ${error.message || response.statusText}`);
    }

    if (params.stream) {
      console.log('OpenRouter: Starting stream');
      return response.body;
    } else {
      const data = await response.json();
      console.log('OpenRouter Response:', {
        model: data.model,
        usage: data.usage,
        finishReason: data.choices[0]?.finish_reason
      });
      return data;
    }
  }

  static async *processStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<string, void, unknown> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let chunkCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('OpenRouter: Stream complete, processed chunks:', chunkCount);
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        chunkCount++;

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.trim() === 'data: [DONE]') continue;

          try {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(5)) as OpenRouterResponse;
              const content = data.choices[0]?.delta?.content || '';
              if (content) {
                yield content;
              }
            }
          } catch (e) {
            console.warn('OpenRouter: Error parsing streaming response:', e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async getModels(): Promise<OpenRouterModel[]> {
    console.log('OpenRouter: Fetching available models');
    const response = await fetch(`${this.baseURL}/models`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/openrouter-dev'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch OpenRouter models');
    }

    const models = await response.json();
    console.log('OpenRouter: Available models:', models.map((m: any) => ({
      id: m.id,
      contextLength: m.context_length
    })));
    return models;
  }

  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  static async chooseModel(content: string, client: OpenRouterClient): Promise<string> {
    const estimatedTokens = this.estimateTokens(content);
    console.log('OpenRouter: Estimated tokens:', estimatedTokens);
    
    const models = await client.getModels();
    console.log('OpenRouter: Finding suitable model for tokens:', estimatedTokens);

    const sortedModels = models.sort((a, b) => 
      (b.context_length || 0) - (a.context_length || 0)
    );

    for (const model of sortedModels) {
      if ((model.context_length || 0) >= estimatedTokens) {
        console.log('OpenRouter: Selected model:', model.id, 'with context length:', model.context_length);
        return model.id;
      }
    }

    console.log('OpenRouter: Defaulting to Claude-2');
    return 'anthropic/claude-2';
  }
}
