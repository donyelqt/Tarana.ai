import { Buffer } from "buffer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { tomtomTrafficService, getTrafficSummary, getTrafficTimeRecommendation, LocationTrafficData } from "./tomtomTraffic";
import { isCurrentlyPeakHours, getManilaTime } from "./peakHours";
import type { AgenticTrafficContext, TrafficAnalysisResult } from "./agenticTrafficAnalyzer";

const TRAFFIC_AGENT_MODEL_ID = process.env.GOOGLE_GEMINI_MODEL?.trim() || "gemini-1.5-flash";
const GOOGLE_GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY || "";

let cachedTrafficModel: ReturnType<GoogleGenerativeAI["getGenerativeModel"]> | null = null;

function getTrafficModel() {
  if (!GOOGLE_GEMINI_API_KEY) {
    throw new Error("GOOGLE_GEMINI_API_KEY is required for the agentic traffic analyzer.");
  }

  if (!cachedTrafficModel) {
    const client = new GoogleGenerativeAI(GOOGLE_GEMINI_API_KEY);
    cachedTrafficModel = client.getGenerativeModel({
      model: TRAFFIC_AGENT_MODEL_ID,
      generationConfig: {
        temperature: 0.15,
        topP: 0.7,
        topK: 32,
        maxOutputTokens: 768,
      },
    });
  }

  return cachedTrafficModel;
}

type TrafficAgentPlan = {
  actions: string[];
};

function extractJson(text: string): any | null {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    return null;
  }
}

function decodeInlineData(data: string | undefined): string | null {
  if (!data) return null;
  try {
    return Buffer.from(data, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

function extractResponsePayload(
  result: Awaited<ReturnType<ReturnType<typeof getTrafficModel>["generateContent"]>>
): string | null {
  const candidates = result.response?.candidates ?? [];

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts ?? [];
    for (const part of parts) {
      if (typeof part?.text === "string" && part.text.trim()) {
        return part.text;
      }

      const inlineText = decodeInlineData((part as any)?.inlineData?.data);
      if (inlineText && inlineText.trim()) {
        return inlineText;
      }
    }
  }

  try {
    const fallback = result.response?.text?.();
    if (typeof fallback === "string" && fallback.trim()) {
      return fallback;
    }
  } catch (error) {
    console.warn("⚠️ Agentic AI: Error reading fallback text from model response", error);
  }

  return null;
}

function normaliseActions(plan: TrafficAgentPlan | null): string[] {
  const defaultPlan = ["GET_TRAFFIC_DATA", "CHECK_PEAK_HOURS", "SUMMARIZE"];
  if (!plan || !Array.isArray(plan.actions) || plan.actions.length === 0) {
    return defaultPlan;
  }

  const sanitized = plan.actions
    .map(action => (typeof action === "string" ? action.trim().toUpperCase() : ""))
    .filter(Boolean);

  const allowed = new Set(["GET_TRAFFIC_DATA", "CHECK_PEAK_HOURS", "SUMMARIZE"]);
  const ordered = sanitized.filter(action => allowed.has(action));

  return ordered.length > 0 ? Array.from(new Set([...ordered, "SUMMARIZE"])) : defaultPlan;
}

interface RunAgenticTrafficParams {
  activityId: string;
  title: string;
  lat: number;
  lon: number;
  peakHours: string;
  context: AgenticTrafficContext;
  initialTrafficData?: LocationTrafficData;
}

interface AgenticTrafficPayload {
  combinedScore: number;
  recommendation: "VISIT_NOW" | "VISIT_SOON" | "AVOID_NOW" | "PLAN_LATER";
  analysis: string;
  bestTimeToVisit: string;
  alternativeTimeSlots: string[];
  crowdLevel: "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
}

async function summariseWithModel(
  params: RunAgenticTrafficParams,
  trafficData: LocationTrafficData | null,
  peakStatus: { isCurrentlyPeak: boolean; peakHours: string; nextLowTrafficTime?: string | undefined }
): Promise<AgenticTrafficPayload | null> {
  const model = getTrafficModel();
  const instruction = `You are the Tarana Traffic Agent. Read the context and respond with strict JSON only.

Return ONLY raw JSON matching this schema:
{
  "combinedScore": number (0-100),
  "recommendation": "VISIT_NOW" | "VISIT_SOON" | "AVOID_NOW" | "PLAN_LATER",
  "analysis": string,
  "bestTimeToVisit": string,
  "alternativeTimeSlots": string[],
  "crowdLevel": "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH"
}

Guidelines:
- Consider both real-time traffic metrics and peak-hour status.
- Be concise but informative in "analysis" (≤3 short sentences).
- Ensure recommendation aligns with congestion severity and user preferences.
- If data is missing, make the safest assumption and note it in the analysis.
`;

  const condensedTraffic = trafficData
    ? {
        trafficLevel: trafficData.trafficLevel,
        congestionScore: trafficData.congestionScore,
        recommendationScore: trafficData.recommendationScore,
        incidentCount: (trafficData.incidents || []).length,
        lastUpdated: trafficData.lastUpdated,
      }
    : null;

  const contextPayload = {
    activity: {
      title: params.title,
      lat: params.lat,
      lon: params.lon,
      peakHours: params.peakHours,
    },
    peakStatus,
    traffic: condensedTraffic,
  };

  const response = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: instruction },
          { text: `Context JSON:\n${JSON.stringify(contextPayload)}` },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      topK: 32,
      maxOutputTokens: 256,
      responseMimeType: "application/json",
    },
  });

  const rawPayload = extractResponsePayload(response);
  const parsed = rawPayload ? (extractJson(rawPayload) as AgenticTrafficPayload | null) : null;

  if (!parsed) {
    const preview = rawPayload ? `${rawPayload.slice(0, 200)}${rawPayload.length > 200 ? "…" : ""}` : "<empty>";
    console.warn(
      `⚠️ Agentic AI: Failed to parse structured traffic JSON for "${params.title}". Raw preview: ${preview}`
    );
  }

  return parsed ?? null;
}

function buildDeterministicPayload(
  params: RunAgenticTrafficParams,
  trafficData: LocationTrafficData | null,
  peakStatus: { isCurrentlyPeak: boolean; peakHours: string; nextLowTrafficTime?: string }
): AgenticTrafficPayload {
  const level = trafficData?.trafficLevel ?? "MODERATE";
  const congestionScore = trafficData?.congestionScore ?? 55;
  const recommendationScore = trafficData?.recommendationScore ?? 60;

  let combinedScore = recommendationScore;
  combinedScore += peakStatus.isCurrentlyPeak ? -15 : 10;
  combinedScore = Math.max(0, Math.min(100, Math.round(combinedScore)));

  let recommendation: AgenticTrafficPayload["recommendation"] = "PLAN_LATER";
  if (combinedScore >= 80 && ["VERY_LOW", "LOW"].includes(level)) {
    recommendation = "VISIT_NOW";
  } else if (combinedScore >= 65 && ["VERY_LOW", "LOW", "MODERATE"].includes(level)) {
    recommendation = "VISIT_SOON";
  } else if (level === "HIGH" || level === "SEVERE") {
    recommendation = "AVOID_NOW";
  }

  const crowdLevelMap: Record<string, AgenticTrafficPayload["crowdLevel"]> = {
    VERY_LOW: "LOW",
    LOW: "LOW",
    MODERATE: "MODERATE",
    HIGH: "HIGH",
    SEVERE: "VERY_HIGH",
    UNKNOWN: "MODERATE"
  };

  const analysisParts: string[] = [];
  if (trafficData) {
    analysisParts.push(`Traffic level ${level.toLowerCase()} (score: ${Math.round(congestionScore)})`);
  } else {
    analysisParts.push("Using cached congestion estimates");
  }
  if (peakStatus.isCurrentlyPeak) {
    analysisParts.push(`Currently inside peak window ${peakStatus.peakHours}`);
  } else if (peakStatus.peakHours) {
    analysisParts.push(`Outside peak window ${peakStatus.peakHours}`);
  }

  const alternativeTimeSlots = peakStatus.isCurrentlyPeak
    ? [peakStatus.nextLowTrafficTime || "After peak hours", "Early morning (7-9 AM)", "Late afternoon (4-6 PM)"]
    : ["Later today", "Early evening (6-8 PM)", "Next off-peak window"];

  const bestTimeToVisit = trafficData
    ? getTrafficTimeRecommendation(trafficData)
    : peakStatus.isCurrentlyPeak
      ? "Plan for the next off-peak window"
      : "Current timing is favorable";

  return {
    combinedScore,
    recommendation,
    analysis: analysisParts.join(". "),
    bestTimeToVisit,
    alternativeTimeSlots: Array.from(new Set(alternativeTimeSlots)),
    crowdLevel: crowdLevelMap[level] || "MODERATE"
  };
}

export async function runAgenticTrafficAnalysis(params: RunAgenticTrafficParams): Promise<TrafficAnalysisResult> {
  let trafficData: LocationTrafficData | null = params.initialTrafficData ?? null;
  let peakStatus: { isCurrentlyPeak: boolean; peakHours: string; nextLowTrafficTime?: string } = {
    isCurrentlyPeak: false,
    peakHours: params.peakHours,
  };

  if (!trafficData) {
    try {
      trafficData = await tomtomTrafficService.getLocationTrafficData(params.lat, params.lon);
    } catch (error) {
      console.error(`❌ Traffic fetch failed inside agent for ${params.title}:`, error);
    }
  }

  const isPeak = isCurrentlyPeakHours(params.peakHours);
  peakStatus = {
    isCurrentlyPeak: isPeak,
    peakHours: params.peakHours,
    nextLowTrafficTime: isPeak ? "Check alternative off-peak slots" : undefined,
  };

  const effectiveTrafficData =
    trafficData || (await tomtomTrafficService.getLocationTrafficData(params.lat, params.lon));

  const deterministic = buildDeterministicResult(params, effectiveTrafficData, peakStatus);
  if (deterministic) {
    console.log(
      `⚡ Agentic AI: Skipping LLM for "${params.title}" due to clear real-time traffic (score ${effectiveTrafficData.congestionScore})`
    );
    return deterministic;
  }

  const summaryPayload = await summariseWithModel(params, effectiveTrafficData, peakStatus);
  const effectivePayload = summaryPayload ?? (() => {
    console.warn(`⚠️ Agentic AI: Using deterministic traffic payload for "${params.title}"`);
    return buildDeterministicPayload(params, effectiveTrafficData, peakStatus);
  })();

  const combinedScore = effectivePayload.combinedScore;
  const recommendation = effectivePayload.recommendation;
  const analysis = effectivePayload.analysis;
  const bestTimeToVisit = effectivePayload.bestTimeToVisit;
  const alternativeTimeSlots = effectivePayload.alternativeTimeSlots;
  const crowdLevel = effectivePayload.crowdLevel;

  return {
    activityId: params.activityId,
    title: params.title,
    lat: params.lat,
    lon: params.lon,
    realTimeTraffic: effectiveTrafficData,
    peakHoursStatus: {
      isCurrentlyPeak: peakStatus.isCurrentlyPeak,
      peakHours: peakStatus.peakHours,
      nextLowTrafficTime: peakStatus.nextLowTrafficTime,
    },
    combinedScore,
    recommendation,
    aiAnalysis: analysis,
    trafficSummary: getTrafficSummary(effectiveTrafficData),
    bestTimeToVisit,
    alternativeTimeSlots,
    crowdLevel,
    lastAnalyzed: new Date(),
  };
}

function buildDeterministicResult(
  params: RunAgenticTrafficParams,
  traffic: LocationTrafficData,
  peakStatus: { isCurrentlyPeak: boolean; peakHours: string; nextLowTrafficTime?: string }
): TrafficAnalysisResult | null {
  const incidentsCount = traffic.incidents?.length ?? 0;
  const isClearTraffic = traffic.congestionScore === 0 && incidentsCount === 0;

  if (!isClearTraffic) {
    return null;
  }

  const recommendation = traffic.trafficLevel === "VERY_LOW" ? "VISIT_NOW" : "VISIT_SOON";
  const combinedScore = Math.min(100, 95 + (peakStatus.isCurrentlyPeak ? -10 : 0));
  const analysis = `Real-time TomTom data shows zero congestion and no incidents near ${params.title}. Proceed confidently—traffic is ${traffic.trafficLevel.toLowerCase()}.`;
  const bestTimeToVisit = getTrafficTimeRecommendation(traffic);
  const alternativeTimeSlots = ["Anytime today", "Late evening"];
  const crowdLevel = traffic.trafficLevel === "VERY_LOW" ? "LOW" : "MODERATE";

  return {
    activityId: params.activityId,
    title: params.title,
    lat: params.lat,
    lon: params.lon,
    realTimeTraffic: traffic,
    peakHoursStatus: {
      isCurrentlyPeak: peakStatus.isCurrentlyPeak,
      peakHours: peakStatus.peakHours,
      nextLowTrafficTime: peakStatus.nextLowTrafficTime,
    },
    combinedScore,
    recommendation,
    aiAnalysis: analysis,
    trafficSummary: getTrafficSummary(traffic),
    bestTimeToVisit,
    alternativeTimeSlots,
    crowdLevel,
    lastAnalyzed: new Date(),
  };
}
