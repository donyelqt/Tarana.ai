import { buildDetailedPrompt } from "../lib/contextBuilder";

// Characterization: buildDetailedPrompt scopes the prompt to the passed
// cityId. The call sites in route.ts / route/route.ts must forward the
// request cityId — omitting it silently falls back to "baguio" while
// retrieval is correctly city-scoped (mixed scoping = wrong-city prompt).
describe("buildDetailedPrompt city scoping", () => {
  const sample: any = { items: [] };

  it("scopes the prompt to the requested city, not the Baguio default", () => {
    const text = buildDetailedPrompt("food trip", sample, {}, [], 2, undefined, undefined, true, "manila");
    expect(text).toContain("Manila");
    expect(text).toContain("(manila)");
  });

  it("keeps Baguio scoping when cityId is baguio", () => {
    const text = buildDetailedPrompt("food trip", sample, {}, [], 2, undefined, undefined, true, "baguio");
    expect(text).toContain("Baguio");
  });
});
