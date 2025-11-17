import crypto from "crypto";

export type AgentStatus = "pending" | "in_progress" | "ready" | "failed" | "completed";

export interface AgentError {
  agent: string;
  stage: string;
  message: string;
  detail?: unknown;
  timestamp: number;
}

export interface WeatherSnapshot {
  raw: unknown;
  description?: string;
  temperatureC?: number;
}

export interface TrafficSnapshot {
  area: string;
  trafficLevel: string;
  recommendationScore?: number;
  raw: unknown;
}

export interface ContextPayload {
  weather?: WeatherSnapshot;
  traffic?: TrafficSnapshot[];
  peakHoursContext?: string;
  crowdContext?: string;
  fetchedAt?: number;
}

export interface RankedActivity {
  title: string;
  score: number;
  tags?: string[];
  trafficAnalysis?: unknown;
  raw?: unknown;
}

export interface RetrievalResult {
  candidates: RankedActivity[];
  expandedQueries: string[];
  coverageScore: number;
  metadata?: Record<string, unknown>;
}

export interface GeneratedItinerary {
  json: unknown;
  prompt?: string;
  rawModelResponse?: string;
}

export interface RequestPreferences {
  interests: string[];
  durationDays: number | null;
  budget?: string;
  pax?: string;
}

export interface RequestSession {
  id: string;
  userId: string;
  prompt: string;
  preferences: RequestPreferences;
  context?: ContextPayload;
  retrieval?: RetrievalResult;
  itinerary?: GeneratedItinerary;
  createdAt: number;
  updatedAt: number;
  status: AgentStatus;
  errors: AgentError[];
}

const sessions = new Map<string, RequestSession>();

export function createSession(params: Omit<RequestSession, "id" | "createdAt" | "updatedAt" | "status" | "errors"> & {
  id?: string;
  status?: AgentStatus;
  errors?: AgentError[];
}): RequestSession {
  const id = params.id ?? crypto.randomUUID();
  const now = Date.now();
  const session: RequestSession = {
    id,
    userId: params.userId,
    prompt: params.prompt,
    preferences: params.preferences,
    context: params.context,
    retrieval: params.retrieval,
    itinerary: params.itinerary,
    createdAt: now,
    updatedAt: now,
    status: params.status ?? "pending",
    errors: params.errors ?? [],
  };
  sessions.set(id, session);
  return session;
}

export function updateSession(sessionId: string, patch: Partial<Omit<RequestSession, "id">>): RequestSession {
  const existing = sessions.get(sessionId);
  if (!existing) {
    throw new Error(`Session ${sessionId} not found`);
  }
  const updated: RequestSession = {
    ...existing,
    ...patch,
    preferences: patch.preferences ? { ...existing.preferences, ...patch.preferences } : existing.preferences,
    context: patch.context ? { ...existing.context, ...patch.context } : existing.context,
    retrieval: patch.retrieval ? { ...existing.retrieval, ...patch.retrieval } : existing.retrieval,
    itinerary: patch.itinerary ? { ...existing.itinerary, ...patch.itinerary } : existing.itinerary,
    errors: patch.errors ? patch.errors : existing.errors,
    updatedAt: Date.now(),
  };
  sessions.set(sessionId, updated);
  return updated;
}

export function appendError(sessionId: string, error: AgentError): RequestSession {
  const existing = sessions.get(sessionId);
  if (!existing) {
    throw new Error(`Session ${sessionId} not found`);
  }
  const updated: RequestSession = {
    ...existing,
    errors: [...existing.errors, error],
    updatedAt: Date.now(),
    status: error.stage === "fatal" ? "failed" : existing.status,
  };
  sessions.set(sessionId, updated);
  return updated;
}

export function getSession(sessionId: string): RequestSession | undefined {
  return sessions.get(sessionId);
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function resetStore(): void {
  sessions.clear();
}
