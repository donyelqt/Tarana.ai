import { supabaseAdmin } from "./supabaseAdmin";
import { generateEmbedding } from "./embeddings";

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
  metadata: Record<string, any>;
}

/**
 * Upsert (insert or update) an embedding row for an activity.
 */
export async function upsertActivityEmbedding(params: {
  activity_id: string;
  textForEmbedding: string;
  metadata?: Record<string, any>;
}) {
  const { activity_id, textForEmbedding, metadata = {} } = params;
  const embedding = await generateEmbedding(textForEmbedding);

  const { error } = await supabaseAdmin.from(EMBEDDINGS_TABLE).upsert({
    activity_id,
    embedding,
    metadata,
  });

  if (error) {
    throw error;
  }
}

/**
 * Perform similarity search using Supabase RPC function `match_activity_embeddings`.
 * See SQL sample in `supabase/migrations` for implementation.
 *
 * @param query      Arbitrary user search query.
 * @param matchCount Number of results to return (default 5).
 */
export async function searchSimilarActivities(query: string, matchCount = 5) {
  const queryEmbedding = await generateEmbedding(query);

  // Call Postgres RPC function that does vector cosine distance search.
  const { data, error } = await supabaseAdmin.rpc("match_activity_embeddings", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
  });

  if (error) throw error;
  return data as Array<{
    activity_id: string;
    similarity: number;
    metadata: any;
  }>;
} 