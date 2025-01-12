import pinecone from "../../lib/pinecone-assistant";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { text } = req.body;
    const index = pinecone.Index(process.env.PINECONE_INDEX); // Ensure this matches your environment variable

    try {
      const embedding = await generateEmbedding(text); // Assuming you have a function to generate embeddings
      await index.upsert([{ id: "unique-id", values: embedding }]);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "Failed to upsert embedding" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
