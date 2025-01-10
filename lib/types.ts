export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TimestampedLine {
  timestamp: string;
  content: string;
}

export interface SourceMetadata {
  fileName?: string;
  content?: string;
  type?: string;
  [key: string]: any;
}

export interface SearchCategory {
  category: string;
  description: string;
  sourceCount: number;
  examples: string[];
}

export interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing?: {
    prompt: number;
    completion: number;
  };
  context_window?: number;
  architecture?: string;
}
