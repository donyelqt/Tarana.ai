import { getSavedItineraries } from '@/lib/data/savedItineraries';
import { fetchWeatherFromAPI } from '@/lib/core/utils';
import { itineraryRefreshService } from '../itineraryRefreshService';
import {
  evaluateAllItineraries,
  evaluateSingleItinerary,
  notifyUsersOfRefreshNeeds,
  type ScheduledEvaluationResult,
} from '../refreshScheduler';
import { logger } from '@/lib/observability/logger';
import type { SavedItinerary } from '@/lib/data/savedItineraries';

jest.mock('@/lib/data/savedItineraries', () => ({
  getSavedItineraries: jest.fn(),
}));

jest.mock('@/lib/core/utils', () => ({
  fetchWeatherFromAPI: jest.fn(),
}));

jest.mock('../itineraryRefreshService', () => ({
  itineraryRefreshService: {
    evaluateRefreshNeed: jest.fn(),
  },
}));

jest.mock('@/lib/observability/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockGetSavedItineraries = getSavedItineraries as jest.MockedFunction<typeof getSavedItineraries>;
const mockFetchWeather = fetchWeatherFromAPI as jest.MockedFunction<typeof fetchWeatherFromAPI>;
const mockEvaluateRefresh = itineraryRefreshService.evaluateRefreshNeed as jest.MockedFunction<typeof itineraryRefreshService.evaluateRefreshNeed>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const requestId = '11111111-1111-4111-8111-111111111111';

function itinerary(overrides: Record<string, unknown> = {}): SavedItinerary {
  return {
    id: 'private-itinerary-id',
    title: 'Private itinerary title',
    formData: { dates: { end: '2099-12-31T00:00:00.000Z' } },
    refreshMetadata: { autoRefreshEnabled: true },
    activityCoordinates: [{ lat: 16.4, lng: 120.6, name: 'Private place' }],
    ...overrides,
  } as unknown as SavedItinerary;
}

function result(overrides: Partial<ScheduledEvaluationResult> = {}): ScheduledEvaluationResult {
  return {
    itineraryId: 'private-itinerary-id',
    itineraryTitle: 'Private itinerary title',
    needsRefresh: true,
    severity: 'HIGH',
    reasons: ['weather changed', 'private reason'],
    confidence: 82,
    evaluatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchWeather.mockResolvedValue({
    weather: [{ main: 'Clouds' }],
    main: { temp: 20 },
  } as Awaited<ReturnType<typeof fetchWeatherFromAPI>>);
  mockEvaluateRefresh.mockResolvedValue({
    needsRefresh: true,
    severity: 'HIGH',
    reasons: ['weather changed', 'private reason'],
    confidence: 82,
  } as unknown as Awaited<ReturnType<typeof itineraryRefreshService.evaluateRefreshNeed>>);
});

describe('refreshScheduler structured logging', () => {
  it('preserves evaluation results while logging only bounded metadata', async () => {
    mockGetSavedItineraries.mockResolvedValue([
      itinerary(),
      itinerary({
        id: 'skipped-private-id',
        title: 'Skipped private title',
        refreshMetadata: { autoRefreshEnabled: false },
      }),
    ]);

    const stats = await evaluateAllItineraries(requestId);

    expect(stats).toEqual(expect.objectContaining({
      totalItineraries: 2,
      evaluatedCount: 1,
      needsRefreshCount: 1,
      skippedCount: 1,
      errorCount: 0,
    }));
    expect(stats.results).toEqual([expect.objectContaining({ needsRefresh: true, severity: 'HIGH' })]);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Itineraries selected for refresh evaluation',
      { entryPoint: 'refreshScheduler', selectedCount: 1, skippedCount: 1 },
      requestId
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Scheduled refresh evaluation completed',
      expect.objectContaining({
        entryPoint: 'refreshScheduler',
        totalItineraries: 2,
        evaluatedCount: 1,
        needsRefreshCount: 1,
        skippedCount: 1,
        errorCount: 0,
      }),
      requestId
    );
    const emittedLogs = JSON.stringify([
      mockLogger.debug.mock.calls,
      mockLogger.info.mock.calls,
      mockLogger.warn.mock.calls,
      mockLogger.error.mock.calls,
    ]);
    expect(emittedLogs).not.toContain('Private itinerary title');
    expect(emittedLogs).not.toContain('private-itinerary-id');
    expect(emittedLogs).not.toContain('private reason');
  });

  it('logs weather unavailability without itinerary data', async () => {
    mockGetSavedItineraries.mockResolvedValue([itinerary()]);
    mockFetchWeather.mockResolvedValue(null);

    const stats = await evaluateAllItineraries(requestId);

    expect(stats.evaluatedCount).toBe(0);
    expect(stats.errorCount).toBe(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Itinerary evaluation skipped',
      { entryPoint: 'refreshScheduler', reason: 'weather_unavailable' },
      requestId
    );
  });

  it('sanitizes scheduler failures', async () => {
    mockGetSavedItineraries.mockRejectedValue(new Error('SENTINEL_SCHEDULER_ERROR'));

    const stats = await evaluateAllItineraries(requestId);

    expect(stats.errorCount).toBe(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Scheduled refresh evaluation failed',
      { entryPoint: 'refreshScheduler', errorName: 'Error' },
      requestId
    );
    expect(JSON.stringify(mockLogger.error.mock.calls)).not.toContain('SENTINEL_SCHEDULER_ERROR');
  });

  it('keeps manual lookup and notification logs free of private identifiers', async () => {
    mockGetSavedItineraries.mockResolvedValue([]);

    const missing = await evaluateSingleItinerary('private-manual-id', requestId);
    await notifyUsersOfRefreshNeeds([result()], requestId);

    expect(missing).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Manual itinerary lookup completed',
      { entryPoint: 'refreshScheduler', found: false },
      requestId
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Refresh notifications prepared',
      { entryPoint: 'refreshScheduler', count: 1, severityCounts: { HIGH: 1 } },
      requestId
    );
    const emittedLogs = JSON.stringify([
      mockLogger.debug.mock.calls,
      mockLogger.info.mock.calls,
      mockLogger.warn.mock.calls,
      mockLogger.error.mock.calls,
    ]);
    expect(emittedLogs).not.toContain('private-manual-id');
    expect(emittedLogs).not.toContain('private-itinerary-id');
    expect(emittedLogs).not.toContain('Private itinerary title');
  });
});
