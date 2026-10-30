
export function parseStoredGoodFor(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((t): t is string => typeof t === 'string');
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((t): t is string => typeof t === 'string');
  } catch {
  }
  return [];
}
