import { isZeroActivityItinerary } from "../lib/zeroActivityItinerary";

describe("isZeroActivityItinerary (H1 zero-result refund helper)", () => {
    it("returns true when text is null or undefined", () => {
        expect(isZeroActivityItinerary(null)).toBe(true);
        expect(isZeroActivityItinerary(undefined)).toBe(true);
        expect(isZeroActivityItinerary("")).toBe(true);
    });

    it("returns true when text is not valid JSON", () => {
        expect(isZeroActivityItinerary("not json at all")).toBe(true);
        expect(isZeroActivityItinerary("{ broken")).toBe(true);
    });

    it("returns true when items array is missing", () => {
        expect(isZeroActivityItinerary(JSON.stringify({ title: "x" }))).toBe(true);
    });

    it("returns true when items array is empty", () => {
        expect(isZeroActivityItinerary(JSON.stringify({ items: [] }))).toBe(true);
    });

    it("returns true when every item has zero activities", () => {
        const text = JSON.stringify({
            title: "Empty Baguio",
            items: [
                { period: "morning", activities: [] },
                { period: "afternoon", activities: [] },
                { period: "evening", activities: [] },
            ],
        });
        expect(isZeroActivityItinerary(text)).toBe(true);
    });

    it("returns false when at least one item has activities even if others are empty (deliverable)", () => {
        // "zero-result" means EVERY period is empty. If even one period has
        // activities, the user got something deliverable — no refund.
        const text = JSON.stringify({
            title: "Partial match",
            items: [
                { period: "morning" }, // no activities key — counted as zero
                { period: "afternoon", activities: [{ title: "Burnham Park" }] },
            ],
        });
        expect(isZeroActivityItinerary(text)).toBe(false);
    });

    it("returns false when at least one item has one or more activities", () => {
        const text = JSON.stringify({
            title: "Real itinerary",
            items: [
                { period: "morning", activities: [{ title: "Burnham Park" }] },
                { period: "afternoon", activities: [] },
                { period: "evening", activities: [] },
            ],
        });
        expect(isZeroActivityItinerary(text)).toBe(false);
    });

    it("returns false when every item has activities (the happy path)", () => {
        const text = JSON.stringify({
            title: "Full itinerary",
            items: [
                { period: "morning", activities: [{ title: "A" }] },
                { period: "afternoon", activities: [{ title: "B" }, { title: "C" }] },
                { period: "evening", activities: [{ title: "D" }] },
            ],
        });
        expect(isZeroActivityItinerary(text)).toBe(false);
    });

    it("returns false for the real Baguio Day 1 sample shape", () => {
        // Mirror of itineraryData.ts sampleItinerary shape: items[*].activities[*].title
        const text = JSON.stringify({
            title: "Baguio Day 1",
            subtitle: "Your curated 1-day Baguio experience",
            items: [
                {
                    period: "morning",
                    activities: [
                        { title: "Goodtaste", image: "/images/goodtaste.png" },
                    ],
                },
                {
                    period: "afternoon",
                    activities: [
                        { title: "Burnham Park", image: "/images/burnham.png" },
                    ],
                },
            ],
        });
        expect(isZeroActivityItinerary(text)).toBe(false);
    });

    it("returns true for an empty-periods payload (poison-filter style response)", () => {
        // Mirrors what GuaranteedJsonEngine.createIntelligentFallback might
        // return when no activities matched: every period has activities:[]
        // and a `reason` explaining the gap.
        const text = JSON.stringify({
            title: "No match",
            items: [
                { period: "morning", activities: [], reason: "no data" },
                { period: "afternoon", activities: [], reason: "no data" },
                { period: "evening", activities: [], reason: "no data" },
            ],
        });
        expect(isZeroActivityItinerary(text)).toBe(true);
    });
});
