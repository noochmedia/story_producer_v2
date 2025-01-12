
import { ChatMessage } from './types';
import { AI_CONFIG } from './ai-config';

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

export class OpenRouterClient {
  private apiKey: string;
  private baseURL = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendMessage(messages: ChatMessage[], maxTokens: number): Promise<string> {
    const model = messages.length > 50 ? "claude-2" : "gpt-4"; // Conditional routing based on message length

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: AI_CONFIG.temperature,
      }),
    });

    const data: OpenRouterResponse = await response.json();
    return data.choices[0]?.message?.content || '';
  }
}
