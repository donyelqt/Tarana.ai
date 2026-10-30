jest.mock("@google/genai", () => {
    const modelsList = {
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
        process.env.GOOGLE_GEMINI_API_KEY = "test-key";
    });

    afterEach(() => {
        delete process.env.GOOGLE_GEMINI_API_KEY;
    });

    it("returns a 768-dimension vector (probed via list())", async () => {
        const { generateEmbedding } = await import("../ai/embeddings");
        const vec = await generateEmbedding("hello world");
        expect(vec).toHaveLength(768);
        expect(typeof vec[0]).toBe("number");
    });

    it("throws an error if API key is not set", async () => {
        delete process.env.GOOGLE_GEMINI_API_KEY;
        const { generateEmbedding } = await import("../ai/embeddings");
        await expect(generateEmbedding("hello world")).rejects.toThrow(
            /Embedding model not initialized/,
        );
    });

    it("throws an error for malformed response", async () => {
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
