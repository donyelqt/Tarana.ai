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
        topP: 0.8,
        topK: 32,
        maxOutputTokens: 1024,
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
}

interface ToolInvocationResult {
  tool: string;
  output: any;
}

interface AgenticTrafficPayload {
  combinedScore: number;
  recommendation: "VISIT_NOW" | "VISIT_SOON" | "AVOID_NOW" | "PLAN_LATER";
  analysis: string;
  bestTimeToVisit: string;
  alternativeTimeSlots: string[];
  crowdLevel: "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
}

function buildPlanPrompt(params: RunAgenticTrafficParams) {
  const { title, lat, lon, peakHours, context } = params;
  const now = getManilaTime().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

  return `You are the Tarana Traffic Agent. The user needs a traffic-aware recommendation for "${title}".

Tools available (you do NOT execute them, you only plan which ones to call):
1. GET_TRAFFIC_DATA — fetches real-time congestion metrics for the provided latitude/longitude.
2. CHECK_PEAK_HOURS — analyses whether the current Manila time is inside the activity's peak hours window.
3. SUMMARIZE — final tool that you MUST call last to craft the recommendation.

Return a JSON object with an "actions" array listing the tools (by name) in the order they should be executed. Example:
{"actions":["GET_TRAFFIC_DATA","CHECK_PEAK_HOURS","SUMMARIZE"]}

Always include SUMMARIZE as the final action.

Context:
- Activity: ${title}
- Coordinates: (${lat}, ${lon})
- Peak hours: ${peakHours || "unknown"}
- Current Manila time: ${now}
- Day: ${context.dayOfWeek} (Weekend: ${context.isWeekend})
- User preferences: ${JSON.stringify(context.userPreferences || {}, null, 2)}
`;
}

async function requestPlan(params: RunAgenticTrafficParams): Promise<string[]> {
  const model = getTrafficModel();
  const prompt = buildPlanPrompt(params);
  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.05,
      maxOutputTokens: 512,
    },
  });

  const rawText = response.response?.text() ?? "";
  const plan = extractJson(rawText) as TrafficAgentPlan | null;
  return normaliseActions(plan);
}

async function summariseWithModel(
  params: RunAgenticTrafficParams,
  trafficData: LocationTrafficData | null,
  peakStatus: { isCurrentlyPeak: boolean; peakHours: string; nextLowTrafficTime?: string | undefined },
  toolOutputs: ToolInvocationResult[]
): Promise<AgenticTrafficPayload | null> {
  const model = getTrafficModel();
  const instruction = `You are the Tarana Traffic Agent. Generate a structured recommendation JSON based on the provided tool outputs.

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

  const contextPayload = {
    activity: {
      title: params.title,
      lat: params.lat,
      lon: params.lon,
      peakHours: params.peakHours,
    },
    peakStatus,
    trafficData,
    toolOutputs,
  };

  const response = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: instruction },
          { text: `Context JSON:\n${JSON.stringify(contextPayload, null, 2)}` },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      topK: 32,
      maxOutputTokens: 768,
    },
  });

  const rawText = response.response?.text() ?? "";
  const parsed = extractJson(rawText) as AgenticTrafficPayload | null;
  return parsed ?? null;
}

export async function runAgenticTrafficAnalysis(params: RunAgenticTrafficParams): Promise<TrafficAnalysisResult> {
  const actions = await requestPlan(params);
  const toolOutputs: ToolInvocationResult[] = [];

  let trafficData: LocationTrafficData | null = null;
  let peakStatus: { isCurrentlyPeak: boolean; peakHours: string; nextLowTrafficTime?: string } = {
    isCurrentlyPeak: false,
    peakHours: params.peakHours,
  };

  for (const action of actions) {
    if (action === "GET_TRAFFIC_DATA") {
      try {
        trafficData = await tomtomTrafficService.getLocationTrafficData(params.lat, params.lon);
        toolOutputs.push({
          tool: "GET_TRAFFIC_DATA",
          output: trafficData,
        });
      } catch (error) {
        toolOutputs.push({
          tool: "GET_TRAFFIC_DATA",
          output: { error: (error as Error).message || "Failed to fetch traffic data." },
        });
      }
    }

    if (action === "CHECK_PEAK_HOURS") {
      const isPeak = isCurrentlyPeakHours(params.peakHours);
      peakStatus = {
        isCurrentlyPeak: isPeak,
        peakHours: params.peakHours,
        nextLowTrafficTime: isPeak ? "Check alternative off-peak slots" : undefined,
      };

      toolOutputs.push({
        tool: "CHECK_PEAK_HOURS",
        output: peakStatus,
      });
    }

    if (action === "SUMMARIZE") {
      break;
    }
  }

  const effectiveTrafficData =
    trafficData || (await tomtomTrafficService.getLocationTrafficData(params.lat, params.lon));

  const summaryPayload = await summariseWithModel(params, effectiveTrafficData, peakStatus, toolOutputs);

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
