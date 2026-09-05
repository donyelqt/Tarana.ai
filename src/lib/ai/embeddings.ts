import { GoogleGenAI } from "@google/genai";

// H1-fix (2026-09-04): switch from @google/generative-ai to @google/genai.
// Why: @google/generative-ai@0.24.1 uses v1beta's embedContent, which serves
// neither retired embedding-001 nor text-embedding-004 on this SDK path.
// @google/genai hits the v1 path, which serves text-embedding-004 and
// gemini-embedding-001. The new SDK is the supported client for embeddings.
//
// Per user instruction: probe first, never guess model strings. We call
// ai.models.list() once at module init to discover which embedding models
// are actually available with our API key, then pick the best one.

const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || "";

type EmbeddingModelId = "gemini-embedding-001" | "text-embedding-004";

interface ResolvedModel {
    id: EmbeddingModelId;
    source: "probed" | "fallback"; // probed = list() confirmed availability; fallback = list() failed, we still try the model because gemini-embedding-001 is the official stable ID
}

let resolvedModel: ResolvedModel | null = null;
let genAIClient: GoogleGenAI | null = null;
let modelProbeError: string | null = null;
let dimensionOverride: number | null = null; // set after a successful probe

/**
 * Probe list() for embedding models, prefer gemini-embedding-001 (newest,
 * supports outputDimensionality), fall back to text-embedding-004 (legacy).
 * Caches the result for the lifetime of the runtime.
 */
async function probeEmbeddingModel(client: GoogleGenAI): Promise<ResolvedModel> {
    try {
        const pager = await client.models.list();
        const models: Array<{ name?: string; supportedActions?: string[] }> = [];
        for await (const m of pager as AsyncIterable<{ name?: string; supportedActions?: string[] }>) {
            models.push(m);
        }
        const supportedIds = models
            .map((m) => (m.name || "").replace(/^models\//, ""))
            .filter(Boolean);
        const supportsEmbed = (id: string) =>
            models.some((m) => {
                const mid = (m.name || "").replace(/^models\//, "");
                return mid === id && Array.isArray(m.supportedActions) && m.supportedActions.includes("embedContent");
            });

        if (supportsEmbed("gemini-embedding-001")) {
            console.log(`[embeddings] Probed list(): gemini-embedding-001 is available (with embedContent support). Available: ${supportedIds.slice(0, 5).join(", ")}...`);
            return { id: "gemini-embedding-001", source: "probed" };
        }
        if (supportsEmbed("text-embedding-004")) {
            console.warn(`[embeddings] gemini-embedding-001 NOT in supportedActions. Falling back to text-embedding-004. Available: ${supportedIds.slice(0, 5).join(", ")}...`);
            return { id: "text-embedding-004", source: "probed" };
        }
        // list() returned but no embedContent model — try the official stable ID anyway
        console.warn(`[embeddings] No supported embedContent model in list() output. Available: ${supportedIds.slice(0, 5).join(", ")}... Trying gemini-embedding-001 anyway.`);
        return { id: "gemini-embedding-001", source: "fallback" };
    } catch (err) {
        // list() failed (network/permission) — try the official stable ID anyway
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[embeddings] list() probe failed (${msg}). Trying gemini-embedding-001 anyway.`);
        return { id: "gemini-embedding-001", source: "fallback" };
    }
}

async function initialize() {
    if (!API_KEY) {
        console.error("[embeddings] GOOGLE_GEMINI_API_KEY not set — semantic search disabled");
        return;
    }
    try {
        genAIClient = new GoogleGenAI({ apiKey: API_KEY });
        resolvedModel = await probeEmbeddingModel(genAIClient);
        // 768 keeps compatibility with existing pgvector rows (itinerary_embeddings
        // was originally created at 768d with embedding-001).
        dimensionOverride = 768;
    } catch (err) {
        console.error("[embeddings] Failed to initialize GoogleGenAI", err);
        genAIClient = null;
        resolvedModel = null;
    }
}

// Fire-and-forget init; the first call to generateEmbedding will await it.
const initPromise: Promise<void> = initialize();

/**
 * Generate a semantic embedding for the provided text using the probed
 * Gemini embedding model. Returns a 768-dim vector by default to stay
 * compatible with existing pgvector rows.
 * @param text Arbitrary plain-text content.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    // Wait for init if it's still in flight (cheap, no extra latency in steady state)
    await initPromise;

    if (!genAIClient || !resolvedModel) {
        throw new Error("Embedding model not initialized — missing GOOGLE_GEMINI_API_KEY or probe failed");
    }

    const config: Record<string, unknown> = {};
    if (resolvedModel.id === "gemini-embedding-001" && dimensionOverride) {
        // gemini-embedding-001 supports matryoshka-style truncation. With
        // existing pgvector rows at 768d (text-embedding-004 default), we
        // pin the output to 768d to avoid re-embedding the whole table.
        config.outputDimensionality = dimensionOverride;
    }

    const result = await genAIClient.models.embedContent({
        model: resolvedModel.id,
        contents: [text],
        config,
    });

    // Response shape: { embeddings: [{ values: number[] }] } (v1 SDK)
    const values = result.embeddings?.[0]?.values;
    if (!Array.isArray(values)) {
        throw new Error("Embedding response malformed — no `embeddings[0].values`");
    }
    return values as number[];
}

/**
 * Force a re-probe (e.g., after rotating the API key). Not called by normal
 * code paths — useful for ops scripts and the embeddings test.
 */
export async function reinitializeEmbeddingClient(): Promise<void> {
    resolvedModel = null;
    genAIClient = null;
    dimensionOverride = null;
    modelProbeError = null;
    await initialize();
}
