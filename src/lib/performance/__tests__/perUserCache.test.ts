import { smartCacheManager } from "../smartCacheManager";

describe("Slice 8 per-user cache isolation", () => {
  beforeEach(() => smartCacheManager.clearAll());

  it("two users with identical payloads receive distinct cached entries", () => {
    const hash = "abc123";
    const key1 = `optimized:user1:${hash}`;
    const key2 = `optimized:user2:${hash}`;
    smartCacheManager.set(key1, { text: "itinerary-user1" });
    smartCacheManager.set(key2, { text: "itinerary-user2" });

    expect(smartCacheManager.get(key1)).toEqual({ text: "itinerary-user1" });
    expect(smartCacheManager.get(key2)).toEqual({ text: "itinerary-user2" });
    expect(smartCacheManager.get(key1)).not.toEqual(smartCacheManager.get(key2));
  });

  it("clearForUser only clears that user's prefix", () => {
    smartCacheManager.set("optimized:user1:hash1", { a: 1 });
    smartCacheManager.set("optimized:user1:hash2", { a: 2 });
    smartCacheManager.set("optimized:user2:hash1", { b: 1 });

    const cleared = smartCacheManager.clearForUser("user1");
    expect(cleared).toBe(2);
    expect(smartCacheManager.get("optimized:user1:hash1")).toBeNull();
    expect(smartCacheManager.get("optimized:user1:hash2")).toBeNull();
    expect(smartCacheManager.get("optimized:user2:hash1")).toEqual({ b: 1 });
  });
});