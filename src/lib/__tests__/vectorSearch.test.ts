import { searchSimilarActivities } from "../search/vectorSearch";

jest.mock("../ai/embeddings", () => ({
  generateEmbedding: jest.fn().mockResolvedValue(Array(768).fill(0.1)),
}));

jest.mock("../data/supabaseAdmin", () => {
  return {
    supabaseAdmin: {
      rpc: jest.fn().mockResolvedValue({
        data: [
          { activity_id: "Burnham Park", similarity: 0.95, metadata: { title: "Burnham Park" } },
        ],
        error: null,
      }),
      from: jest.fn().mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ error: null }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
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