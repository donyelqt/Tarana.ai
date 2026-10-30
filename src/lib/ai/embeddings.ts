import { GoogleGenAI } from "@google/genai";


const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || "";

type EmbeddingModelId = "gemini-embedding-001" | "text-embedding-004";

interface ResolvedModel {
    id: EmbeddingModelId;
    source: "probed" | "fallback"; 
}

let resolvedModel: ResolvedModel | null = null;
let genAIClient: GoogleGenAI | null = null;
let modelProbeError: string | null = null;
let dimensionOverride: number | null = null; 

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
        console.warn(`[embeddings] No supported embedContent model in list() output. Available: ${supportedIds.slice(0, 5).join(", ")}... Trying gemini-embedding-001 anyway.`);
        return { id: "gemini-embedding-001", source: "fallback" };
    } catch (err) {
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
        dimensionOverride = 768;
    } catch (err) {
        console.error("[embeddings] Failed to initialize GoogleGenAI", err);
        genAIClient = null;
        resolvedModel = null;
    }
}

const initPromise: Promise<void> = initialize();

export async function generateEmbedding(text: string): Promise<number[]> {
    await initPromise;

    if (!genAIClient || !resolvedModel) {
        throw new Error("Embedding model not initialized — missing GOOGLE_GEMINI_API_KEY or probe failed");
    }

    const config: Record<string, unknown> = {};
    if (resolvedModel.id === "gemini-embedding-001" && dimensionOverride) {
        config.outputDimensionality = dimensionOverride;
    }

    const result = await genAIClient.models.embedContent({
        model: resolvedModel.id,
        contents: [text],
        config,
    });

    const values = result.embeddings?.[0]?.values;
    if (!Array.isArray(values)) {
        throw new Error("Embedding response malformed — no `embeddings[0].values`");
    }
    return values as number[];
}

export async function reinitializeEmbeddingClient(): Promise<void> {
    resolvedModel = null;
    genAIClient = null;
    dimensionOverride = null;
    modelProbeError = null;
    await initialize();
}
