import { NextResponse } from 'next/server'
import { AI_CONFIG } from '@/lib/ai-config'

export async function POST(req: Request) {
  const { messages, projectDetails, sources, model, temperature, max_tokens, prompts = [], stream = false } = await req.json()

  console.log('Received sources in chat API:', sources ? 'Sources available' : 'No sources available');

  const systemMessage = `${AI_CONFIG.systemPrompt}

Project Details: ${projectDetails || 'No project details available'}

Available Sources:
${sources || 'No sources available'}

Available Prompts:
${Array.isArray(prompts) ? prompts.map((prompt: string, index: number) => `${index + 1}. ${prompt}`).join('\n') : ''}

IMPORTANT: Always refer to and use the provided sources in your responses. If relevant information is available in the sources, incorporate it into your answer.`

  console.log('Sending request to DeepSeek API...');
  const response = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPINFRA_TOKEN}`,
    },
    body: JSON.stringify({
      model: "deepseek-ai/DeepSeek-V3",
      messages: [
        { role: "system", content: systemMessage },
        ...messages
      ],
      temperature,
      max_tokens,
      stream,
    }),
  })

  if (!response.ok) {
    console.error('DeepSeek API request failed:', await response.text());
    throw new Error(`DeepSeek API request failed`);
  }

  // Handle streaming response
  if (stream) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = response.body?.getReader();
    
    if (!reader) {
      throw new Error('No response body available for streaming');
    }

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk
                .split('\n')
                .filter(line => line.trim() !== '');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') {
                    controller.close();
                    return;
                  }
                  try {
                    const parsed = JSON.parse(data);
                    const text = parsed.choices[0]?.delta?.content || '';
                    controller.enqueue(encoder.encode(text));
                  } catch (e) {
                    console.error('Error parsing streaming response:', e);
                  }
                }
              }
            }
          } catch (error) {
            controller.error(error);
          }
        },
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    );
  }

  // Handle regular response
  const data = await response.json();
  console.log('Received response from DeepSeek API');
  return NextResponse.json(data);
}