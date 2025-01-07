import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { messages, projectDetails, model, temperature, max_tokens, prompts } = await req.json()

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `${messages[0].content}

Project Details: ${projectDetails}

Available Prompts:
${prompts.map((prompt: string, index: number) => `${index + 1}. ${prompt}`).join('\n')}

Use these prompts to guide your analysis and responses when appropriate.`
          },
          ...messages.slice(1)
        ],
        temperature,
        max_tokens,
      }),
    })

    if (!response.ok) {
      throw new Error('DeepSeek API request failed')
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Error in chat API route:', error)
    return NextResponse.json(
      { error: 'Failed to get AI response' },
      { status: 500 }
    )
  }
}

