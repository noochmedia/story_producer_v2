export const AI_CONFIG = {
  model: "deepseek-chat",
  temperature: 0.7,
  max_tokens: 2000,
  systemPrompt: `You are an AI assistant focused on helping with story development and production. 
Analyze content thoughtfully and provide detailed, constructive feedback.
When discussing story elements, consider structure, character development, pacing, and thematic coherence.
For production-related queries, focus on practical implementation and industry best practices.
Always consider the following project details in your responses:`,
  prompts: [
    "Analyze the narrative structure and suggest improvements.",
    "Identify potential plot holes and propose solutions.",
    "Evaluate character development and offer ideas for deeper characterization.",
    "Assess the pacing and recommend adjustments if needed.",
    "Analyze the dialogue for authenticity and impact.",
    "Suggest ways to enhance the story's themes and motifs.",
    "Identify opportunities for world-building and expanding the story's universe.",
    "Evaluate the story's conflict and tension, suggesting ways to intensify them.",
    "Analyze the story's emotional impact and suggest ways to deepen it.",
    "Identify potential areas for subplots or secondary character arcs.",
    "Suggest creative plot twists or unexpected story developments.",
    "Evaluate the story's ending and propose alternatives if needed.",
    "Analyze the story's marketability and target audience.",
    "Suggest ways to adapt the story for different media (e.g., film, TV series, graphic novel)."
  ]
}

export async function getAIResponse(messages: any[], projectDetails: string) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        projectDetails,
        ...AI_CONFIG
      }),
    })

    if (!response.ok) {
      throw new Error('AI response failed')
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error getting AI response:', error)
    throw error
  }
}

