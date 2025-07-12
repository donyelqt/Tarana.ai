import { generateEmbedding } from "../embeddings";

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
  it("returns a 768-dimension vector", async () => {
    const vec = await generateEmbedding("hello world");
    expect(vec).toHaveLength(768);
    expect(typeof vec[0]).toBe("number");
  });
}); 