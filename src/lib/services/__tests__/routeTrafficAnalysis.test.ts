import { routeTrafficAnalyzer } from '../routeTrafficAnalysis';
import type { RouteData, TrafficLevel } from '@/types/route-optimization';

jest.mock('@/lib/traffic/tomtomTraffic', () => ({
  tomtomTrafficService: { getLocationTrafficData: jest.fn() },
}));
jest.mock('@/lib/traffic/peakHours', () => ({
  isPeakHour: jest.fn(() => false),
  getPeakHourMultiplier: jest.fn(() => 1.0),
  getNextPeakHour: jest.fn(() => null),
}));

const { tomtomTrafficService } = jest.requireMock('@/lib/traffic/tomtomTraffic');

function makeLocationData(overrides: Record<string, any> = {}) {
  return {
    lat: 16.4023,
    lon: 120.5960,
    incidents: [],
    trafficLevel: 'LOW' as TrafficLevel,
    congestionScore: 21,
    recommendationScore: 80,
    lastUpdated: new Date(),
    ...overrides,
  };
}

function makeRoute(overrides: Partial<RouteData> = {}) {
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    summary: {
      lengthInMeters: 8000,
      travelTimeInSeconds: 600,
      trafficDelayInSeconds: 0,
      departureTime: new Date().toISOString(),
      arrivalTime: new Date(Date.now() + 600_000).toISOString(),
      routeType: 'fastest' as const,
    },
    legs: [],
    geometry: {
      coordinates: [
        { lat: 16.4023, lng: 120.5960 },
        { lat: 16.4150, lng: 120.5975 },
        { lat: 16.4250, lng: 120.6000 },
        { lat: 16.4350, lng: 120.6050 },
      ],
      type: 'LineString' as const,
    },
    instructions: [],
    ...overrides,
  } as RouteData;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================================
// RC1 + RC3: overallTrafficLevel matches congestionScore, not incident data
// ============================================================================
describe('overallTrafficLevel matches congestionScore (RC1, RC3)', () => {
  // NOTE: estimateSegmentSpeed uses trafficData.congestionScore to compute
  // speedKmh = 50 * (1 - congestionScore/100), and the final overall
  // congestionScore is recomputed from speed ratios. So we mock the TomTom
  // congestionScore such that the resulting overall score lands in the
  // desired traffic-level bucket.
  //
  //   trafficData.congestionScore 5   -> speedKmh 47.5 -> segmentCongestion 21 -> LOW
  //   trafficData.congestionScore 45  -> speedKmh 27.5 -> segmentCongestion 54 -> HIGH
  //   trafficData.congestionScore 75  -> speedKmh 12.5 -> segmentCongestion 79 -> SEVERE

  it('overall score ~21 -> LOW (not SEVERE, even with incident)', async () => {
    (tomtomTrafficService.getLocationTrafficData as jest.Mock).mockResolvedValue(
      makeLocationData({
        trafficLevel: 'SEVERE',
        congestionScore: 5,
        incidents: [{
          id: 'inc-1',
          iconCategory: 2,
          magnitudeOfDelay: 5,
          events: [],
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          from: 'Point A',
          to: 'Point B',
          length: 100,
          delay: 300,
          roadNumbers: [],
          timeValidity: '',
        }],
      })
    );

    const route = makeRoute();
    const result = await routeTrafficAnalyzer.analyzeRouteTraffic(route);

    expect(result.congestionScore).toBeLessThan(25);
    expect(result.overallTrafficLevel).toBe('LOW');
    expect(result.overallTrafficLevel).not.toBe('SEVERE');
  });

  it('overall score ~54 -> HIGH', async () => {
    (tomtomTrafficService.getLocationTrafficData as jest.Mock).mockResolvedValue(
      makeLocationData({ congestionScore: 45 })
    );
    const route = makeRoute();
    const result = await routeTrafficAnalyzer.analyzeRouteTraffic(route);
    expect(result.congestionScore).toBeGreaterThanOrEqual(50);
    expect(result.congestionScore).toBeLessThan(75);
    expect(result.overallTrafficLevel).toBe('HIGH');
  });

  it('overall score ~79 -> SEVERE', async () => {
    (tomtomTrafficService.getLocationTrafficData as jest.Mock).mockResolvedValue(
      makeLocationData({ congestionScore: 75 })
    );
    const route = makeRoute();
    const result = await routeTrafficAnalyzer.analyzeRouteTraffic(route);
    expect(result.congestionScore).toBeGreaterThanOrEqual(75);
    expect(result.overallTrafficLevel).toBe('SEVERE');
  });
});

// ============================================================================
// RC4: getTrafficLevelValue -> VERY_LOW = 0, not 2
// ============================================================================
describe('Traffic level value mapping (RC4)', () => {
  it('VERY_LOW segments do not inflate the worst-level comparison', async () => {
    let callCount = 0;
    (tomtomTrafficService.getLocationTrafficData as jest.Mock).mockImplementation(
      () => {
        callCount++;
        const level = callCount <= 2 ? 'VERY_LOW' : 'MODERATE';
        return Promise.resolve(makeLocationData({
          trafficLevel: level,
          congestionScore: callCount <= 2 ? 5 : 30,
        }));
      }
    );

    const route = makeRoute({
      geometry: {
        coordinates: [
          { lat: 16.400, lng: 120.590 },
          { lat: 16.410, lng: 120.595 },
          { lat: 16.420, lng: 120.600 },
          { lat: 16.430, lng: 120.605 },
          { lat: 16.440, lng: 120.610 },
          { lat: 16.450, lng: 120.615 },
          { lat: 16.460, lng: 120.620 },
        ],
        type: 'LineString',
      },
    });

    const result = await routeTrafficAnalyzer.analyzeRouteTraffic(route);

    expect(result.overallTrafficLevel).not.toBe('SEVERE');
    expect(result.overallTrafficLevel).not.toBe('HIGH');
    expect(['VERY_LOW', 'LOW', 'MODERATE']).toContain(result.overallTrafficLevel);
  });
});

describe('Edge cases', () => {
  it('single-coordinate route does not crash', async () => {
    (tomtomTrafficService.getLocationTrafficData as jest.Mock).mockResolvedValue(
      makeLocationData()
    );

    const route = makeRoute({
      geometry: {
        coordinates: [{ lat: 16.4, lng: 120.6 }],
        type: 'LineString',
      },
    });

    const result = await routeTrafficAnalyzer.analyzeRouteTraffic(route);
    expect(result).toBeDefined();
    expect(result.overallTrafficLevel).toBeDefined();
    expect(result.congestionScore).toBeGreaterThanOrEqual(0);
    expect(result.congestionScore).toBeLessThanOrEqual(100);
  });

  it('multiple route analyses produce consistent levels', async () => {
    (tomtomTrafficService.getLocationTrafficData as jest.Mock).mockResolvedValue(
      makeLocationData({ congestionScore: 20 })
    );

    const route1 = makeRoute();
    const route2 = makeRoute();

    const result1 = await routeTrafficAnalyzer.analyzeRouteTraffic(route1);
    const result2 = await routeTrafficAnalyzer.analyzeRouteTraffic(route2);

    expect(result1.overallTrafficLevel).toBe(result2.overallTrafficLevel);
    expect(result1.congestionScore).toBe(result2.congestionScore);
  });
});
