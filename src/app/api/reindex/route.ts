import { NextRequest, NextResponse } from "next/server";
import { upsertActivityEmbedding } from "@/lib/search";
import { sampleItinerary } from "@/app/itinerary-generator/data/itineraryData";
import { timingSafeEqual } from "crypto";
import { timedHttp } from '@/lib/observability/httpMetrics';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';

const LOG_ENTRY_POINT = '/api/reindex';

// Simple auth via header X-ADMIN-TOKEN that must match env.REINDEX_SECRET
const ADMIN_TOKEN = process.env.REINDEX_SECRET || "";

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  return timedHttp(LOG_ENTRY_POINT, 'POST', async () => {
  const providedToken = req.headers.get("x-admin-token") || ""; 

  // Ensure the secret is configured on the server and is not an empty string.
  if (!ADMIN_TOKEN) {
    logger.error('Reindex secret is not configured', { entryPoint: LOG_ENTRY_POINT }, requestId);
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
      const errorName = result.reason instanceof Error ? result.reason.name : 'UnknownError';
      logger.error(
        'Reindex embedding failed',
        { entryPoint: LOG_ENTRY_POINT, activityIndex: index, errorName },
        requestId
      );
    }
  });

  return NextResponse.json({
    total: activities.length,
    indexed: successfulUpserts,
    failed: activities.length - successfulUpserts,
  });
  }, (res) => res.status);
}