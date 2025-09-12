jest.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockReturnValue({
          embedContent: jest.fn().mockResolvedValue({
            embedding: { values: Array(768).fill(0.123) },
          }),
        }),
      };
    }),
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

  it("returns a 768-dimension vector", async () => {
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
      "Embedding model not initialized – missing GOOGLE_GEMINI_API_KEY"
    );
  });

  it("throws an error for malformed response", async () => {
    // Mock the generative model to return a malformed response
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    GoogleGenerativeAI.mockImplementation(() => {
      return {
        getGenerativeModel: jest.fn().mockReturnValue({
          embedContent: jest.fn().mockResolvedValue({
            embedding: { values: null }, // Malformed
          }),
        }),
      };
    });
    const { generateEmbedding } = await import("../ai/embeddings");
    await expect(generateEmbedding("hello world")).rejects.toThrow(
      "Embedding response malformed"
    );
  });
});