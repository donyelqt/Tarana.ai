import { ItineraryRefreshService } from '../itineraryRefreshService';
import { tomtomTrafficService } from '../../traffic/tomtomTraffic';
import type { SavedItinerary } from '../../data/savedItineraries';
import type { WeatherData } from '../../core/utils';

jest.mock('@/lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../traffic/tomtomTraffic', () => ({
  tomtomTrafficService: { getLocationTrafficData: jest.fn() },
}));

const mockedTraffic = tomtomTrafficService.getLocationTrafficData as unknown as jest.Mock;

function weather(condition: string, temp: number): WeatherData {
  return {
    weather: [{ main: condition }],
    main: { temp },
  } as unknown as WeatherData;
}

function itinerary(overrides: Record<string, unknown> = {}): SavedItinerary {
  return {
    id: 'itin-traffic',
    weatherData: weather('Clear', 20),
    refreshMetadata: {
      trafficSnapshot: {
        averageCongestionScore: 20,
        averageTrafficLevel: 'LOW',
        incidentCount: 0,
        timestamp: new Date(),
        locationSamples: [],
      },
    },
    ...overrides,
  } as unknown as SavedItinerary;
}

function traffic(level: 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE', score: number, incidents: Array<{ magnitudeOfDelay: number }> = []) {
  return {
    lat: 16.4,
    lon: 120.6,
    trafficLevel: level,
    congestionScore: score,
    incidents,
    recommendationScore: 50,
    lastUpdated: new Date(),
  };
}

const coords = [{ lat: 16.4, lon: 120.6 }];

describe('itineraryRefreshService traffic thresholds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('triggers refresh when real-time congestion jumps past the threshold', async () => {
    mockedTraffic.mockResolvedValue(traffic('HIGH', 60));
    const service = new ItineraryRefreshService();

    const result = await service.evaluateRefreshNeed(itinerary(), weather('Clear', 20), coords);

    expect(result.needsRefresh).toBe(true);
    expect(result.reasons).toContain('TRAFFIC_DEGRADATION');
    expect(result.trafficChange?.congestionDelta).toBe(40);
  });

  it('triggers refresh on a critical real-time incident even without congestion growth', async () => {
    mockedTraffic.mockResolvedValue(traffic('MODERATE', 25, [{ magnitudeOfDelay: 4 }]));
    const service = new ItineraryRefreshService();

    const result = await service.evaluateRefreshNeed(itinerary(), weather('Clear', 20), coords);

    expect(result.needsRefresh).toBe(true);
    expect(result.reasons).toContain('INCIDENT_DETECTED');
    expect(result.trafficChange?.criticalIncidents).toBe(1);
  });

  it('stays quiet when real-time traffic is unchanged', async () => {
    mockedTraffic.mockResolvedValue(traffic('LOW', 22));
    const service = new ItineraryRefreshService();

    const result = await service.evaluateRefreshNeed(itinerary(), weather('Clear', 20), coords);

    expect(result.needsRefresh).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it('fails closed to no-refresh when the traffic feed errors', async () => {
    mockedTraffic.mockRejectedValue(new Error('tomtom down'));
    const service = new ItineraryRefreshService();

    const result = await service.evaluateRefreshNeed(itinerary(), weather('Clear', 20), coords);

    expect(result.needsRefresh).toBe(false);
    expect(result.trafficChange).toBeNull();
  });
});
