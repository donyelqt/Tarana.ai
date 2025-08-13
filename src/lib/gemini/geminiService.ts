import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiResponse } from './types';

// Global initialization for Gemini model
const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || "";
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
const geminiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" }) : null;

export function initializeGemini() {
  if (!API_KEY) {
    throw new Error("GOOGLE_GEMINI_API_KEY is missing!");
  }
  if (!genAI || !geminiModel) {
    throw new Error("Gemini model is not initialized.");
  }
  return geminiModel;
}

export async function generateItinerary(prompt: string): Promise<GeminiResponse> {
  const model = initializeGemini();
  
  const generationConfig = {
    responseMimeType: "application/json",
    temperature: 1.5,
    topK: 30,
    topP: 0.8,
    maxOutputTokens: 8192,
  };

  const MAX_RETRIES = 3;
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
      });

      const response = result.response;
      let text = response.text();
      
      if (!text) {
        const candidate = response.candidates?.[0];
        const parts = candidate?.content?.parts;
        if (Array.isArray(parts)) {
          text = parts.map(p => p.text || '').join('');
        }
        if (!text) {
          return { text: "", error: "Gemini response is empty", fullResponse: response };
        }
      }

      return { text };
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      
      if (attempt < MAX_RETRIES && (status === 503 || status === 429)) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.warn(`Gemini transient error (status ${status}). Retry ${attempt} of ${MAX_RETRIES} after ${delay}ms`);
        await sleep(delay);
        continue;
      }
      
      if (status === 429) {
        throw new Error("API quota exceeded. Please check your plan and billing details, or try again later.");
      } else if (status === 503) {
        throw new Error("The Gemini model is currently overloaded. Please try again shortly.");
      }
      
      throw err;
    }
  }

  throw new Error("Failed to generate content after multiple retries due to service unavailability.");
}