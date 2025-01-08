import { NextResponse } from 'next/server'
import { AI_CONFIG } from '@/lib/ai-config'

export async function POST(req: Request) {
  const { messages, projectDetails, sources, model, temperature, max_tokens, prompts } = await req.json()

  console.log('Received sources in chat API:', sources ? 'Sources available' : 'No sources available');

  const systemMessage = `${AI_CONFIG.systemPrompt}

Project Details: ${projectDetails}

Available Sources:
${sources || 'No sources available'}

Available Prompts:
${prompts.map((prompt: string, index: number) => `${index + 1}. ${prompt}`).join('\n')}

IMPORTANT: Always refer to and use the provided sources in your responses. If relevant information is available in the sources, incorporate it into your answer.`

  console.log('Sending request to DeepSeek API...');
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemMessage },
        ...messages
      ],
      temperature,
      max_tokens,
    }),
  })

  if (!response.ok) {
    console.error('DeepSeek API request failed:', await response.text());
    throw new Error(`DeepSeek API request failed`);
  }

  const data = await response.json()
  console.log('Received response from DeepSeek API');
  return NextResponse.json(data)
}

