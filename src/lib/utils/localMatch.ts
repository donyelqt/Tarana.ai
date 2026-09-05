/**
 * Compact local text-match for the Baguio never-500 safety net.
 * Pure functions — no I/O, unit-tested.
 */
export interface LocalMatchable {
  title: string;
  desc?: string;
  tags?: string[];
}

/** Interest strings → match terms. Strips the "Random" sentinel (mirrors the
 *  TomTom query builder) and drops ≤3-char tokens that over-match
 *  ("art" hits "heart", "earth", "artists"). */
export function extractMatchTerms(interests: unknown): string[] {
  return (Array.isArray(interests) ? interests : [])
    .filter((i): i is string => typeof i === "string" && !!i && i !== "Random")
    .flatMap((i) => i.toLowerCase().split(/[^a-z0-9]+/))
    .filter((w) => w.length > 3);
}

/** Terms + weather gating over a local catalog. Empty terms = no preference
 *  (full catalog, weather-gated). Empty weather list = no weather filter. */
export function matchLocalActivities<T extends LocalMatchable>(
  activities: T[],
  terms: string[],
  allowedWeatherTags: string[],
): T[] {
  return (activities ?? []).filter((a) => {
    const tags = Array.isArray(a.tags) ? a.tags : [];
    if (
      allowedWeatherTags.length > 0 &&
      !tags.some((t) => allowedWeatherTags.includes(t))
    )
      return false;
    if (terms.length === 0) return true;
    const hay = `${a.title ?? ""} ${a.desc ?? ""} ${tags.join(" ")}`.toLowerCase();
    return terms.some((t) => hay.includes(t));
  });
}
