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

  const partText =
    response.response?.candidates?.[0]?.content?.parts?.find(part => "text" in part)?.text ?? "";
  const parsed = extractJson(partText) as AgenticTrafficPayload | null;
  return parsed ?? null;
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

  const summaryPayload = await summariseWithModel(params, effectiveTrafficData, peakStatus);

  const combinedScore = summaryPayload?.combinedScore ?? 60;
  const recommendation = summaryPayload?.recommendation ?? "PLAN_LATER";
  const analysis = summaryPayload?.analysis ?? "Fallback analysis applied.";
  const bestTimeToVisit = summaryPayload?.bestTimeToVisit ?? getTrafficTimeRecommendation(effectiveTrafficData);
  const alternativeTimeSlots = summaryPayload?.alternativeTimeSlots ?? ["Early morning", "Late afternoon"];
  const crowdLevel = summaryPayload?.crowdLevel ?? "MODERATE";

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
