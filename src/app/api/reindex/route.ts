import { NextRequest, NextResponse } from "next/server";
import { upsertActivityEmbedding } from "@/lib/search";
import { sampleItinerary } from "@/app/itinerary-generator/data/itineraryData";
import { timingSafeEqual } from "crypto";

// Simple auth via header X-ADMIN-TOKEN that must match env.REINDEX_SECRET
const ADMIN_TOKEN = process.env.REINDEX_SECRET || "";

export async function POST(req: NextRequest) {
  const providedToken = req.headers.get("x-admin-token") || "";

  // Ensure the secret is configured on the server and is not an empty string.
  if (!ADMIN_TOKEN) {
    console.error("REINDEX_SECRET is not set. Aborting.");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use a constant-time comparison to prevent timing attacks.
  // Note: This requires the Node.js runtime, not the Edge runtime.
  const providedTokenBuffer = Buffer.from(providedToken, "utf8");
  const adminTokenBuffer = Buffer.from(ADMIN_TOKEN, "utf8");

  if (
    providedTokenBuffer.length !== adminTokenBuffer.length ||
    !timingSafeEqual(providedTokenBuffer, adminTokenBuffer)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activities = sampleItinerary.items.flatMap((s) => s.activities);

  const upsertPromises = activities.map((act) => {
    // Using `(act.image as any)` suggests the type could be more specific.
    const imageUrl =
      typeof act.image === "string" ? act.image : (act.image as any)?.src || "";
    return upsertActivityEmbedding({
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
  });

  const results = await Promise.allSettled(upsertPromises);

  const successfulUpserts = results.filter((r) => r.status === "fulfilled").length;
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`Failed to embed activity "${activities[index].title}":`, result.reason);
    }
  });

  return NextResponse.json({
    total: activities.length,
    indexed: successfulUpserts,
    failed: activities.length - successfulUpserts,
  });
}