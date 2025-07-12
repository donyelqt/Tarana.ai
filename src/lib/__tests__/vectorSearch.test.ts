import { searchSimilarActivities } from "../vectorSearch";

jest.mock("../embeddings", () => ({
  generateEmbedding: jest.fn().mockResolvedValue(Array(768).fill(0.1)),
}));

jest.mock("../supabaseAdmin", () => {
  return {
    supabaseAdmin: {
      rpc: jest.fn().mockResolvedValue({
        data: [
          { activity_id: "Burnham Park", similarity: 0.95, metadata: { title: "Burnham Park" } },
        ],
        error: null,
      }),
    },
  };
});

describe("searchSimilarActivities", () => {
  it("returns results from supabase RPC", async () => {
    const res = await searchSimilarActivities("park", 5);
    expect(res[0].activity_id).toBe("Burnham Park");
  });
}); 