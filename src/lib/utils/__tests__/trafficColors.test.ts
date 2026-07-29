import { getTrafficLevelFromScore, getTrafficColorFromScore, getTrafficLevelClasses } from '../trafficColors';
import { TrafficLevel } from '@/types/route-optimization';

// ============================================================================
// RC2: Threshold alignment across trafficColors.ts
// ============================================================================
describe('getTrafficLevelFromScore — threshold alignment (RC2)', () => {
  const thresholds: [number, TrafficLevel][] = [
    [0, 'VERY_LOW'],
    [5, 'VERY_LOW'],
    [14, 'VERY_LOW'],
    [15, 'LOW'],
    [20, 'LOW'],
    [24, 'LOW'],
    [25, 'MODERATE'],
    [30, 'MODERATE'],
    [49, 'MODERATE'],
    [50, 'HIGH'],
    [60, 'HIGH'],
    [74, 'HIGH'],
    [75, 'SEVERE'],
    [85, 'SEVERE'],
    [100, 'SEVERE'],
  ];

  thresholds.forEach(([score, expected]) => {
    it(`congestion score ${score} → ${expected}`, () => {
      expect(getTrafficLevelFromScore(score)).toBe(expected);
    });
  });
});

// ============================================================================
// RC1 validation: 21% score (from screenshot) maps to LOW, NOT SEVERE
// ============================================================================
describe('Regression — 21% congestion (screenshot bug)', () => {
  it('should map 21% congestion score to LOW (not SEVERE)', () => {
    expect(getTrafficLevelFromScore(21)).toBe('LOW');
  });

  it('should map 21% congestion to green color (not red)', () => {
    const scheme = getTrafficColorFromScore(21);
    expect(scheme.color).toBe('#22c55e'); // green-500
    expect(scheme.textColor).toBe('#15803d'); // green-700
  });
});

// ============================================================================
// RC2: Color mapping consistency
// ============================================================================
describe('getTrafficColorFromScore — color mapping', () => {
  it('VERY_LOW (0-14) should be emerald', () => {
    const scheme = getTrafficColorFromScore(5);
    expect(scheme.color).toBe('#10b981'); // emerald
    expect(scheme.backgroundColor).toBe('rgba(16, 185, 129, 0.1)');
  });

  it('LOW (15-24) should be green', () => {
    const scheme = getTrafficColorFromScore(20);
    expect(scheme.color).toBe('#22c55e');
  });

  it('MODERATE (25-49) should be yellow', () => {
    const scheme = getTrafficColorFromScore(35);
    expect(scheme.color).toBe('#eab308');
  });

  it('HIGH (50-74) should be orange', () => {
    const scheme = getTrafficColorFromScore(60);
    expect(scheme.color).toBe('#f97316');
  });

  it('SEVERE (75-100) should be red', () => {
    const scheme = getTrafficColorFromScore(90);
    expect(scheme.color).toBe('#ef4444');
  });
});

// ============================================================================
// Edge cases
// ============================================================================
describe('Traffic level edge cases', () => {
  it('negative score should return VERY_LOW', () => {
    expect(getTrafficLevelFromScore(-5)).toBe('VERY_LOW');
  });

  it('score above 100 should return SEVERE', () => {
    expect(getTrafficLevelFromScore(150)).toBe('SEVERE');
  });

  it('fractional scores should use integer thresholds', () => {
    // 24.9 should still be LOW (not >=25, not MODERATE)
    expect(getTrafficLevelFromScore(24.9)).toBe('LOW');
    // 25.0 should be MODERATE
    expect(getTrafficLevelFromScore(25)).toBe('MODERATE');
  });
});