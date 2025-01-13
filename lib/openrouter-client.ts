
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
      console.log('Sending OpenRouter stream request:', {
        model,
        messageCount: messages.length,
        maxTokens,
        stream: true
      });

      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), 60000); // 60 second timeout

      // Filter out any empty messages
      const validMessages = messages.filter(msg => msg.content.trim().length > 0);
      if (validMessages.length === 0) {
        throw new Error('No valid messages to send');
      }

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        signal: abortController.signal,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey.replace(/^(Bearer\s+)?/, '')}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://story-producer-v2.vercel.app',
          'X-Title': 'Story Producer',
          'User-Agent': 'Story Producer/1.0.0'
        },
        body: JSON.stringify({
          model,
          messages: validMessages,
          max_tokens: maxTokens,
          temperature: AI_CONFIG.temperature,
          stream: true
        }),
      });

      clearTimeout(timeout);
      
      const headers = Object.fromEntries(response.headers.entries());
      if (headers['x-clerk-auth-status'] === 'signed-out') {
        throw new Error('Authentication failed: Please check your OpenRouter API key');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          headers
        };
        console.error('OpenRouter streaming error:', error);
        throw new Error(`OpenRouter API error: ${response.status} - ${JSON.stringify(error)}`);
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
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), 60000); // 60 second timeout

      // Filter out any empty messages
      const validMessages = messages.filter(msg => msg.content.trim().length > 0);
      if (validMessages.length === 0) {
        throw new Error('No valid messages to send');
      }

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        signal: abortController.signal,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey.replace(/^(Bearer\s+)?/, '')}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://story-producer-v2.vercel.app',
          'X-Title': 'Story Producer',
          'User-Agent': 'Story Producer/1.0.0'
        },
        body: JSON.stringify({
          model,
          messages: validMessages,
          max_tokens: maxTokens,
          temperature: AI_CONFIG.temperature,
          stream: false // Set to false for analysis to get complete response
        }),
      });

      clearTimeout(timeout);
      
      const headers = Object.fromEntries(response.headers.entries());
      if (headers['x-clerk-auth-status'] === 'signed-out') {
        throw new Error('Authentication failed: Please check your OpenRouter API key');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          headers
        };
        console.error('OpenRouter API error:', error);
        throw new Error(`OpenRouter API error: ${response.status} - ${JSON.stringify(error)}`);
      }

      console.log('OpenRouter response received:', {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      const rawData = await response.text();
      console.log('OpenRouter raw response:', rawData.substring(0, 500) + '...');
      
      const data = JSON.parse(rawData);
      console.log('OpenRouter response parsed:', {
        raw: rawData.substring(0, 100) + '...',
        hasChoices: !!data.choices,
        firstChoice: data.choices?.[0] ? {
          hasMessage: !!data.choices[0].message,
          hasContent: !!data.choices[0].message?.content,
          contentLength: data.choices[0].message?.content?.length
        } : null
      });
      const content = data.choices?.[0]?.message?.content || data.choices?.[0]?.text;
      
      if (content) {
        console.log('Analysis content received:', {
          length: content.length,
          preview: content.substring(0, 100) + '...'
        });
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
