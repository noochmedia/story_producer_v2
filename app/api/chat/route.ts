import { NextResponse } from 'next/server'
import { AI_CONFIG } from '../../../lib/ai-config'

export async function POST(req: Request) {
  const { messages, projectDetails, sources, model, temperature, max_tokens, prompts = [], stream = false } = await req.json()

  console.log('Received request payload:', {
    hasMessages: messages?.length > 0,
    hasProjectDetails: !!projectDetails,
    sourcesLength: sources?.length || 0,
    temperature,
    max_tokens
  });

  const systemMessage = `${AI_CONFIG.systemPrompt}

Project Details: ${projectDetails || 'No project details available'}

Available Sources:
${sources || 'No sources available'}`

  console.log('System message length:', systemMessage.length);
  console.log('First 500 chars of system message:', systemMessage.substring(0, 500));

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
      temperature: temperature || AI_CONFIG.temperature,
      max_tokens: max_tokens || AI_CONFIG.max_tokens,
      stream,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text();
    console.error('DeepSeek API request failed:', errorText);
    throw new Error(`DeepSeek API request failed: ${errorText}`);
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
            // Send initial "thinking" message
            controller.enqueue(encoder.encode('Let me analyze that for you...\n\n'));

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              console.log('Received chunk:', chunk);

              const lines = chunk
                .split('\n')
                .filter(line => line.trim() !== '');

              for (const line of lines) {
                console.log('Processing line:', line);
                
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') {
                    console.log('Received [DONE] signal');
                    controller.close();
                    return;
                  }
                  try {
                    const parsed = JSON.parse(data);
                    console.log('Parsed response:', parsed);
                    
                    // Try different response formats
                    let text = '';
                    if (parsed.choices?.[0]?.delta?.content) {
                      text = parsed.choices[0].delta.content;
                    } else if (parsed.choices?.[0]?.text) {
                      text = parsed.choices[0].text;
                    } else if (typeof parsed === 'string') {
                      text = parsed;
                    }

                    if (text) {
                      console.log('Sending text:', text);
                      controller.enqueue(encoder.encode(text));
                    }
                  } catch (e) {
                    console.error('Error parsing streaming response:', e);
                    console.log('Problematic data:', data);
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error in streaming response:', error);
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
