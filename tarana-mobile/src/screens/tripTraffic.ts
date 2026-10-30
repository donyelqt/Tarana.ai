import type { SpotTraffic } from '../data';

export function isTrafficTag(tag: string): boolean {
  return tag === 'low-traffic' || tag === 'moderate-traffic';
}

export function activityTrafficLevel(level: string | undefined, tags?: string[]): SpotTraffic | null {
  const v = (level ?? '').toUpperCase();
  if (v === 'VERY_LOW' || v === 'LOW') return 'LOW';
  if (v === 'MODERATE' || v === 'HIGH' || v === 'SEVERE') return v;
  for (const tag of tags ?? []) {
    if (!isTrafficTag(tag)) continue;
    return tag === 'low-traffic' ? 'LOW' : 'MODERATE';
  }
  return null;
}
