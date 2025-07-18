import { NextRequest, NextResponse } from "next/server";
import { upsertActivityEmbedding } from "@/lib/vectorSearch";
import { sampleItinerary } from "@/app/itinerary-generator/data/itineraryData";

// Simple auth via header X-ADMIN-TOKEN that must match env.REINDEX_SECRET
const ADMIN_TOKEN = process.env.REINDEX_SECRET || "";

export async function POST(req: NextRequest) {
  const providedToken = req.headers.get("x-admin-token") || "";
  if (!ADMIN_TOKEN || providedToken !== ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activities = sampleItinerary.items.flatMap((s) => s.activities);
  let success = 0;
  for (const act of activities) {
    try {
      const imageUrl = typeof act.image === "string" ? act.image : (act.image as any)?.src || "";
      await upsertActivityEmbedding({
        activity_id: act.title,
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
    } catch (err) {
      console.error("Failed to embed", act.title, err);
    }
  }

  return NextResponse.json({ indexed: success, total: activities.length });
} 