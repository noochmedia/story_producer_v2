interface TranscriptionResult {
  text: string
  speakers: { id: number; text: string }[]
  summary: string
  keywords: string[]
  sentiment: {
    overall: string
    byParagraph: { text: string; sentiment: string }[]
  }
}

export async function transcribeFile(file: File): Promise<TranscriptionResult> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 3000))

  // Simulated transcription result with summary, keywords, and sentiment analysis
  const result: TranscriptionResult = {
    text: "This is a simulated transcription of the uploaded file.",
    speakers: [
      { id: 1, text: "Hello, this is speaker one. How are you today?" },
      { id: 2, text: "Hi speaker one, I'm speaker two. I'm doing well, thank you." },
      { id: 1, text: "That's great to hear. Shall we discuss the project?" },
      { id: 2, text: "Certainly, I've prepared some notes on our progress." },
      { id: 1, text: "Excellent. Let's start with the timeline. Are we on track?" },
      { id: 2, text: "Yes, we're currently on schedule. The first phase is complete." },
      { id: 1, text: "Great news. What about the budget? Any concerns there?" },
      { id: 2, text: "We're slightly under budget, which gives us some flexibility for unexpected costs." },
      { id: 1, text: "That's perfect. Is there anything else we need to address today?" },
      { id: 2, text: "Yes, we should discuss the upcoming client presentation next week." },
    ],
    summary: "In this conversation, two speakers discuss a project. They confirm that the project is on schedule, with the first phase complete. The budget is reported to be slightly under, providing flexibility for unexpected costs. The speakers plan to discuss an upcoming client presentation scheduled for next week.",
    keywords: ["project", "timeline", "budget", "client presentation", "schedule", "progress"],
    sentiment: {
      overall: "Positive",
      byParagraph: [
        { text: "Hello, this is speaker one. How are you today?", sentiment: "Neutral" },
        { text: "Hi speaker one, I'm speaker two. I'm doing well, thank you.", sentiment: "Positive" },
        { text: "That's great to hear. Shall we discuss the project?", sentiment: "Positive" },
        { text: "Certainly, I've prepared some notes on our progress.", sentiment: "Positive" },
        { text: "Excellent. Let's start with the timeline. Are we on track?", sentiment: "Neutral" },
        { text: "Yes, we're currently on schedule. The first phase is complete.", sentiment: "Positive" },
        { text: "Great news. What about the budget? Any concerns there?", sentiment: "Neutral" },
        { text: "We're slightly under budget, which gives us some flexibility for unexpected costs.", sentiment: "Positive" },
        { text: "That's perfect. Is there anything else we need to address today?", sentiment: "Positive" },
        { text: "Yes, we should discuss the upcoming client presentation next week.", sentiment: "Neutral" }
      ]
    }
  }

  return result
}

