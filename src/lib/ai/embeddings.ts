import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini embeddings model once per runtime to avoid overhead.
const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || "";

let embeddingModel: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null = null;

if (API_KEY) {
  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    // The "embedding-001" model returns 768-dimension vectors.
    embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
  } catch (err) {
    console.error("[embeddings] Failed to initialize GoogleGenerativeAI", err);
  }
}

/**
 * Generate a semantic embedding for the provided text using Google Gemini.
 * Falls back to an empty array if the model is not available.
 * @param text Arbitrary plain-text content (≤ 8K tokens recommended).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!embeddingModel) {
    throw new Error("Embedding model not initialized – missing GOOGLE_GEMINI_API_KEY");
  }

  // Google Generative AI SDK requires `content` (singular) for embeddings – can be a plain string.
  const result = await embeddingModel.embedContent(text);

  // The SDK returns { embedding: { values: number[] } }
  if (!result || !result.embedding || !Array.isArray(result.embedding.values)) {
    throw new Error("Embedding response malformed");
  }
  return result.embedding.values as number[];
} 