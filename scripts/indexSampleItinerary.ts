import { config as loadEnv } from "dotenv";

// Load .env first (if present), then .env.local to override / supplement
loadEnv();
loadEnv({ path: ".env.local", override: true });

/*
  Batch embed and upsert all activities from the built-in sample itinerary.
  Usage:
    # Ensure env vars are set: GOOGLE_GEMINI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    pnpm tsx scripts/indexSampleItinerary.ts   # or npm run index-embeddings
*/

import { upsertActivityEmbedding } from "../src/lib/vectorSearch";
import { sampleItinerary } from "../src/app/itinerary-generator/components/itineraryData";

async function main() {
  const activities = sampleItinerary.items.flatMap((section) => section.activities);
  console.log(`Indexing ${activities.length} activities…`);

  let success = 0;
  for (const act of activities) {
    try {
      const id = act.title; // simplistic unique key; change to UUID if needed
      const imageUrl = typeof act.image === "string" ? act.image : (act.image as any)?.src || "";
      await upsertActivityEmbedding({
        activity_id: id,
        textForEmbedding: `${act.title}. ${act.desc}`,
        metadata: {
          title: act.title,
          desc: act.desc,
          tags: act.tags,
          time: act.time,
          image: imageUrl,
        },
      });
      success += 1;
      console.log(`✅ Upserted: ${id}`);
    } catch (err) {
      console.error(`❌ Failed upserting ${act.title}`, err);
    }
  }
  console.log(`Finished. Upserted ${success}/${activities.length} activities.`);
  process.exit(0);
}

main(); 