import { supabaseAdmin } from '../data/supabaseAdmin';
import { generateEmbedding } from '../ai/embeddings';

const EMBEDDINGS_TABLE = "itinerary_embeddings";

export interface ActivityEmbedding {
  id: string;
  activity_id: string;
  embedding: number[]; 
  metadata: Record<string, unknown>;
}

export async function upsertActivityEmbedding(params: {
  activity_id: string;
  textForEmbedding: string;
  metadata?: Record<string, any>;
}) {
  if (!supabaseAdmin) {
    console.error("Supabase admin client is not initialized for upsertActivityEmbedding.");
    throw new Error("Supabase admin client not available.");
  }
  const { activity_id, textForEmbedding, metadata } = params;
  if (typeof textForEmbedding !== "string") {
    throw new Error("textForEmbedding must be a string");
  }
  const embedding = await generateEmbedding(textForEmbedding);
  const { error } = await supabaseAdmin.from(EMBEDDINGS_TABLE).upsert({
    activity_id,
    embedding,
    metadata: metadata || {},
  });
  if (error) {
    throw error;
  }
}

const vectorSearchCache = new Map<string, { result: Array<{ activity_id: string; similarity: number; metadata: Record<string, unknown>; }>; timestamp: number }>();
const VECTOR_CACHE_DURATION = 10 * 60 * 1000; 

export async function searchSimilarActivities(query: string | string[], matchCount = 5): Promise<Array<{ activity_id: string; similarity: number; metadata: Record<string, any>; }>> {
  if (!supabaseAdmin) {
    console.error("Supabase admin client is not initialized for searchSimilarActivities.");
    return [];
  }
  if (Array.isArray(query)) {
    const batchResults = await Promise.all(query.map(q => typeof q === "string" ? searchSimilarActivities(q, matchCount) : []));
    return batchResults.flat();
  }
  if (typeof query !== "string") {
    throw new Error("Query must be a string");
  }
  const cacheKey = `${query}_${matchCount}`;
  
  const cached = vectorSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < VECTOR_CACHE_DURATION) {
    return cached.result;
  }
  
  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabaseAdmin.rpc("match_activity_embeddings", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
  });

  if (error) throw error;
  
  const result = data as Array<{
    activity_id: string;
    similarity: number;
    metadata: Record<string, any>;
  }>;
  
  vectorSearchCache.set(cacheKey, {
    result,
    timestamp: Date.now()
  });
  
  if (vectorSearchCache.size > 50) {
    const now = Date.now();
    for (const [key, value] of vectorSearchCache.entries()) {
      if (now - value.timestamp > VECTOR_CACHE_DURATION) {
        vectorSearchCache.delete(key);
      }
    }
  }
  
  return result;
} 

export function createVectorScoreMap(similarActivities: Array<{
  activity_id: string;
  similarity: number;
  metadata: Record<string, any>;
}> | Array<Array<{
  activity_id: string;
  similarity: number;
  metadata: Record<string, any>;
}>>): Map<string, number> {
  const scoreMap = new Map<string, number>();
  
  const activities = (Array.isArray(similarActivities) && similarActivities.length > 0 && Array.isArray(similarActivities[0]))
    ? (similarActivities as Array<Array<{ activity_id: string; similarity: number; metadata: Record<string, any>; }>>).flat()
    : (similarActivities as Array<{ activity_id: string; similarity: number; metadata: Record<string, any>; }>);
  
  for (const activity of activities) {
    const title: string = activity.metadata?.title || activity.activity_id;
    if (scoreMap.has(title)) {
      scoreMap.set(title, Math.max(scoreMap.get(title)!, activity.similarity));
    } else {
      scoreMap.set(title, activity.similarity);
    }
  }
  
  return scoreMap;
}