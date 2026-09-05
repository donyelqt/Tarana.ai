// Mock the new @google/genai SDK. Per the H1-fix (2026-09-04), the embeddings
// module now uses GoogleGenAI + models.embedContent, not the v1beta SDK.
jest.mock("@google/genai", () => {
    const modelsList = {
        // AsyncIterable contract — list() returns a PagerAsync<Model>
        [Symbol.asyncIterator]: async function* () {
            yield { name: "models/gemini-embedding-001", supportedActions: ["embedContent"] };
            yield { name: "models/text-embedding-004", supportedActions: ["embedContent"] };
        },
    };
    const embedContent = jest.fn().mockResolvedValue({
        embeddings: [{ values: Array(768).fill(0.123) }],
    });
    return {
        GoogleGenAI: jest.fn().mockImplementation(() => ({
            models: { list: jest.fn().mockResolvedValue(modelsList), embedContent },
        })),
    };
});

describe("generateEmbedding", () => {
    beforeEach(() => {
        jest.resetModules();
        // Set a dummy API key for tests
        process.env.GOOGLE_GEMINI_API_KEY = "test-key";
    });

    afterEach(() => {
        // Clear the dummy API key after tests
        delete process.env.GOOGLE_GEMINI_API_KEY;
    });

    it("returns a 768-dimension vector (probed via list())", async () => {
        const { generateEmbedding } = await import("../ai/embeddings");
        const vec = await generateEmbedding("hello world");
        expect(vec).toHaveLength(768);
        expect(typeof vec[0]).toBe("number");
    });

    it("throws an error if API key is not set", async () => {
        // Unset the API key
        delete process.env.GOOGLE_GEMINI_API_KEY;
        // We need to re-import the module to re-evaluate the API key check
        const { generateEmbedding } = await import("../ai/embeddings");
        await expect(generateEmbedding("hello world")).rejects.toThrow(
            /Embedding model not initialized/,
        );
    });

    it("throws an error for malformed response", async () => {
        // Override the embedContent mock for this test
        const { GoogleGenAI } = require("@google/genai");
        GoogleGenAI.mockImplementation(() => ({
            models: {
                list: jest.fn().mockResolvedValue({
                    [Symbol.asyncIterator]: async function* () {
                        yield { name: "models/gemini-embedding-001", supportedActions: ["embedContent"] };
                    },
                }),
                embedContent: jest.fn().mockResolvedValue({ embeddings: [{ values: null }] }),
            },
        }));
        const { generateEmbedding } = await import("../ai/embeddings");
        await expect(generateEmbedding("hello world")).rejects.toThrow(
            /Embedding response malformed/,
        );
    });
});
