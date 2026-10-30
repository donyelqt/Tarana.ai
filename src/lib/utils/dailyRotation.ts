export function rotateByDay<T>(items: T[], dayIndex: number): T[] {
  if (!Array.isArray(items) || items.length <= 1) return [...items];
  const offset = Math.floor(dayIndex) % items.length;
  if (offset <= 0) return [...items];
  return [...items.slice(offset), ...items.slice(0, offset)];
}
