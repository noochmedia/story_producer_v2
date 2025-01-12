import pinecone from "../lib/pinecone-assistant";

(async () => {
  await pinecone.init({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT, // "us-east1-aws"
  });

  const index = pinecone.Index(process.env.PINECONE_INDEX);

  try {
    const description = await index.describeIndexStats();
    console.log("Index Description:", description);
  } catch (error) {
    console.error("Error:", error);
  }
})();
