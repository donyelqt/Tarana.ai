export interface LocalMatchable {
  title: string;
  desc?: string;
  tags?: string[];
}

export function extractMatchTerms(interests: unknown): string[] {
  return (Array.isArray(interests) ? interests : [])
    .filter((i): i is string => typeof i === "string" && !!i && i !== "Random")
    .flatMap((i) => i.toLowerCase().split(/[^a-z0-9]+/))
    .filter((w) => w.length > 3);
}

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
