import { supabaseAdmin } from '../data/supabaseAdmin';
import { generateEmbedding } from '../ai/embeddings';

/**
 * Name of the table that stores activity embeddings.
 * Ensure this table exists in Supabase with columns:
 *  - id uuid primary key default uuid_generate_v4()
 *  - activity_id text (can be same as title or a UUID reference)
 *  - embedding vector(768)
 *  - metadata jsonb
 */
const EMBEDDINGS_TABLE = "itinerary_embeddings";

export interface ActivityEmbedding {
  id: string;
  activity_id: string;
  embedding: number[]; // 768 length
  metadata: Record<string, unknown>;
}

/**
 * Upsert (insert or update) an embedding row for an activity.
 */
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

// Simple in-memory cache for vector search results
const vectorSearchCache = new Map<string, { result: Array<{ activity_id: string; similarity: number; metadata: Record<string, unknown>; }>; timestamp: number }>();
const VECTOR_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Perform similarity search using Supabase RPC function `match_activity_embeddings`.
 * See SQL sample in `supabase/migrations` for implementation.
 * Optimized with caching for faster repeated queries.
 *
 * @param query      Arbitrary user search query or array of queries.
 * @param matchCount Number of results to return (default 5).
 */
export async function searchSimilarActivities(query: string | string[], matchCount = 5): Promise<Array<{ activity_id: string; similarity: number; metadata: Record<string, any>; }>> {
  if (!supabaseAdmin) {
    console.error("Supabase admin client is not initialized for searchSimilarActivities.");
    return [];
  }
  // Handle batch processing for multiple queries
  if (Array.isArray(query)) {
    const batchResults = await Promise.all(query.map(q => typeof q === "string" ? searchSimilarActivities(q, matchCount) : []));
    return batchResults.flat();
  }
  if (typeof query !== "string") {
    throw new Error("Query must be a string");
  }
  // Generate a cache key based on the query and match count
  const cacheKey = `${query}_${matchCount}`;
  
  // Check cache for recent similar vector search requests
  const cached = vectorSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < VECTOR_CACHE_DURATION) {
    return cached.result;
  }
  
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  // Call Postgres RPC function that does vector cosine distance search.
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
  
  // Cache the result
  vectorSearchCache.set(cacheKey, {
    result,
    timestamp: Date.now()
  });
  
  // Clean old cache entries periodically
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

/**
 * Create a map of activity titles to their vector similarity scores for use in the heuristic scheduler.
 * This allows the scheduler to prioritize activities based on their semantic relevance to the user's query.
 *
 * @param similarActivities Array of similar activities from searchSimilarActivities
 * @returns Map of activity titles to similarity scores
 */
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
  
  // Handle both single result set and batch results
  const activities = (Array.isArray(similarActivities) && similarActivities.length > 0 && Array.isArray(similarActivities[0]))
    ? (similarActivities as Array<Array<{ activity_id: string; similarity: number; metadata: Record<string, any>; }>>).flat()
    : (similarActivities as Array<{ activity_id: string; similarity: number; metadata: Record<string, any>; }>);
  
  for (const activity of activities) {
    const title: string = activity.metadata?.title || activity.activity_id;
    // If we already have this title, keep the higher similarity score
    if (scoreMap.has(title)) {
      scoreMap.set(title, Math.max(scoreMap.get(title)!, activity.similarity));
    } else {
      scoreMap.set(title, activity.similarity);
    }
  }
  
  return scoreMap;
}