
import { ChatMessage } from './types';
import { AI_CONFIG } from './ai-config';

interface OpenRouterStreamResponse {
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

  async streamResponse(
    messages: ChatMessage[], 
    maxTokens: number,
    controller: ReadableStreamDefaultController
  ): Promise<boolean> {
    const model = messages.length > 50 ? "anthropic/claude-2" : "openai/gpt-4";
    const encoder = new TextEncoder();

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/noochmedia/story_producer_v2',
          'X-Title': 'Story Producer v2'
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature: AI_CONFIG.temperature,
          stream: true
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.includes('[DONE]')) continue;

          try {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6)) as OpenRouterStreamResponse;
              const content = data.choices[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(`data: ${content}\n\n`));
              }
            }
          } catch (error) {
            console.error('Error parsing stream line:', error);
          }
        }
      }

      return true;
    } catch (error) {
      console.error('OpenRouter streaming error:', error);
      throw error;
    }
  }

  async generateAnalysis(
    messages: ChatMessage[],
    maxTokens: number,
    controller: ReadableStreamDefaultController
  ): Promise<string> {
    const model = "anthropic/claude-2"; // Use Claude for analysis
    const encoder = new TextEncoder();
    let fullResponse = '';

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/noochmedia/story_producer_v2',
          'X-Title': 'Story Producer v2'
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature: AI_CONFIG.temperature,
          stream: false // Set to false for analysis to get complete response
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (content) {
        fullResponse = content;
        controller.enqueue(encoder.encode(`data: ${content}\n\n`));
      }

      return fullResponse;
    } catch (error) {
      console.error('OpenRouter analysis error:', error);
      throw error;
    }
  }
}
