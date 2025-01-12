import { Pinecone } from "@pinecone-database/pinecone";

if (!process.env.PINECONE_API_KEY) {
  throw new Error('PINECONE_API_KEY is not set');
}

if (!process.env.PINECONE_HOST) {
  throw new Error('PINECONE_HOST is not set');
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
});

export default pinecone;
