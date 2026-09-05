import { extractMatchTerms, matchLocalActivities } from "@/lib/utils/localMatch";

describe("extractMatchTerms", () => {
  it('strips the "Random" sentinel and splits compound labels', () => {
    expect(extractMatchTerms(["Random", "Food & Culinary"])).toEqual([
      "food",
      "culinary",
    ]);
  });

  it("drops short tokens and non-strings", () => {
    expect(extractMatchTerms(["Culture & Arts", "", null, 7])).toEqual([
      "culture",
      "arts",
    ]);
  });
});

describe("matchLocalActivities", () => {
  const catalog = [
    {
      title: "BenCab Museum",
      desc: "Art museum with indigenous Cordillera collections",
      tags: ["museum", "culture", "indoor"],
    },
    {
      title: "Burnham Park",
      desc: "Central park with boating lake and gardens",
      tags: ["park", "outdoor", "nature"],
    },
    {
      title: "Camp John Hay",
      desc: "Forest picnic grounds and historic retreat",
      tags: ["nature", "outdoor", "history"],
    },
  ];

  it("hits title/desc/tags", () => {
    const hits = matchLocalActivities(catalog, ["museum"], []);
    expect(hits.map((a) => a.title)).toEqual(["BenCab Museum"]);
  });

  it("empty terms returns full catalog", () => {
    expect(matchLocalActivities(catalog, [], [])).toHaveLength(3);
  });

  it("weather gate filters", () => {
    const hits = matchLocalActivities(catalog, [], ["indoor"]);
    expect(hits.map((a) => a.title)).toEqual(["BenCab Museum"]);
  });

  it("null input returns empty array", () => {
    expect(matchLocalActivities(null as unknown as typeof catalog, ["museum"], [])).toEqual([]);
  });
});
