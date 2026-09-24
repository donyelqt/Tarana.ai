/**
 * Background Refresh Scheduler
 * Automated evaluation of saved itineraries for refresh needs
 * 
 * @module refreshScheduler
 * @author Tarana.ai Engineering Team
 */

import { getSavedItineraries, SavedItinerary } from '../data/savedItineraries';
import { itineraryRefreshService } from './itineraryRefreshService';
import { fetchWeatherFromAPI } from '../core/utils';
import { logger } from '@/lib/observability/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface ScheduledEvaluationResult {
  itineraryId: string;
  itineraryTitle: string;
  needsRefresh: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasons: string[];
  confidence: number;
  evaluatedAt: Date;
}

export interface SchedulerStats {
  totalItineraries: number;
  evaluatedCount: number;
  needsRefreshCount: number;
  skippedCount: number;
  errorCount: number;
  duration: number;
  results: ScheduledEvaluationResult[];
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const LOG_ENTRY_POINT = 'refreshScheduler';

const SCHEDULER_CONFIG = {
  evaluationIntervalHours: 6, // Don't re-evaluate within 6 hours
  maxRefreshesPerDay: 4, // Limit refreshes per itinerary per day
  batchSize: 10, // Process in batches to avoid overload
  batchDelayMs: 1000, // Delay between batches
};

// ============================================================================
// MAIN SCHEDULER FUNCTION
// ============================================================================

/**
 * Evaluate all saved itineraries for refresh needs
 * Called by cron job or manual trigger
 */
export async function evaluateAllItineraries(requestId?: string): Promise<SchedulerStats> {
  const startTime = Date.now();
  logger.info('Scheduled refresh evaluation started', { entryPoint: LOG_ENTRY_POINT }, requestId);

  const stats: SchedulerStats = {
    totalItineraries: 0,
    evaluatedCount: 0,
    needsRefreshCount: 0,
    skippedCount: 0,
    errorCount: 0,
    duration: 0,
    results: []
  };

  try {
    logger.debug('Loading itineraries for refresh evaluation', { entryPoint: LOG_ENTRY_POINT }, requestId);
    const allItineraries = await getSavedItineraries();
    stats.totalItineraries = allItineraries.length;
    logger.info(
      'Itineraries loaded for refresh evaluation',
      { entryPoint: LOG_ENTRY_POINT, totalItineraries: stats.totalItineraries },
      requestId
    );

    if (allItineraries.length === 0) {
      logger.info('Refresh evaluation has no itineraries', { entryPoint: LOG_ENTRY_POINT }, requestId);
      stats.duration = Date.now() - startTime;
      return stats;
    }

    const itinerariesToEvaluate = filterItinerariesForEvaluation(allItineraries, requestId);
    stats.skippedCount = stats.totalItineraries - itinerariesToEvaluate.length;
    logger.info(
      'Itineraries selected for refresh evaluation',
      {
        entryPoint: LOG_ENTRY_POINT,
        selectedCount: itinerariesToEvaluate.length,
        skippedCount: stats.skippedCount,
      },
      requestId
    );

    const batches = createBatches(itinerariesToEvaluate, SCHEDULER_CONFIG.batchSize);
    logger.info(
      'Refresh evaluation batches created',
      { entryPoint: LOG_ENTRY_POINT, batchCount: batches.length, batchSize: SCHEDULER_CONFIG.batchSize },
      requestId
    );

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      logger.debug(
        'Refresh evaluation batch started',
        {
          entryPoint: LOG_ENTRY_POINT,
          batchNumber: i + 1,
          batchCount: batches.length,
          itineraryCount: batch.length,
        },
        requestId
      );

      const batchResults = await processBatch(batch, requestId);
      batchResults.forEach(result => {
        if (result) {
          stats.results.push(result);
          stats.evaluatedCount++;
          if (result.needsRefresh) stats.needsRefreshCount++;
        } else {
          stats.errorCount++;
        }
      });

      if (i < batches.length - 1) {
        logger.debug(
          'Refresh evaluation batch delay',
          {
            entryPoint: LOG_ENTRY_POINT,
            delayMs: SCHEDULER_CONFIG.batchDelayMs,
            batchesRemaining: batches.length - i - 1,
          },
          requestId
        );
        await delay(SCHEDULER_CONFIG.batchDelayMs);
      }
    }

    stats.duration = Date.now() - startTime;
    logger.info(
      'Scheduled refresh evaluation completed',
      {
        entryPoint: LOG_ENTRY_POINT,
        totalItineraries: stats.totalItineraries,
        evaluatedCount: stats.evaluatedCount,
        needsRefreshCount: stats.needsRefreshCount,
        skippedCount: stats.skippedCount,
        errorCount: stats.errorCount,
        durationMs: stats.duration,
      },
      requestId
    );

    return stats;
  } catch (error) {
    logger.error(
      'Scheduled refresh evaluation failed',
      { entryPoint: LOG_ENTRY_POINT, errorName: error instanceof Error ? error.name : typeof error },
      requestId
    );
    stats.duration = Date.now() - startTime;
    stats.errorCount++;
    return stats;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Filter itineraries that should be evaluated
 */
function filterItinerariesForEvaluation(
  itineraries: SavedItinerary[],
  requestId?: string
): SavedItinerary[] {
  const now = Date.now();
  const evaluationInterval = SCHEDULER_CONFIG.evaluationIntervalHours * 60 * 60 * 1000;

  return itineraries.filter(itinerary => {
    if (itinerary.refreshMetadata?.autoRefreshEnabled === false) {
      logger.debug(
        'Itinerary skipped',
        { entryPoint: LOG_ENTRY_POINT, reason: 'auto_refresh_disabled' },
        requestId
      );
      return false;
    }

    const lastEval = itinerary.refreshMetadata?.lastEvaluatedAt;
    if (lastEval) {
      const timeSinceEval = now - new Date(lastEval).getTime();
      if (timeSinceEval < evaluationInterval) {
        logger.debug(
          'Itinerary skipped',
          { entryPoint: LOG_ENTRY_POINT, reason: 'evaluated_recently' },
          requestId
        );
        return false;
      }
    }

    const refreshCount = itinerary.refreshMetadata?.refreshCount || 0;
    const lastRefresh = itinerary.refreshMetadata?.lastRefreshedAt;
    if (lastRefresh) {
      const hoursSinceRefresh = (now - new Date(lastRefresh).getTime()) / (60 * 60 * 1000);
      if (hoursSinceRefresh < 24 && refreshCount >= SCHEDULER_CONFIG.maxRefreshesPerDay) {
        logger.debug(
          'Itinerary skipped',
          { entryPoint: LOG_ENTRY_POINT, reason: 'max_refreshes_reached' },
          requestId
        );
        return false;
      }
    }

    const endDate = new Date(itinerary.formData.dates.end);
    if (endDate < new Date()) {
      logger.debug(
        'Itinerary skipped',
        { entryPoint: LOG_ENTRY_POINT, reason: 'trip_completed' },
        requestId
      );
      return false;
    }

    return true;
  });
}

/**
 * Create batches from array
 */
function createBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Process a batch of itineraries
 */
async function processBatch(
  itineraries: SavedItinerary[],
  requestId?: string
): Promise<(ScheduledEvaluationResult | null)[]> {
  return Promise.all(itineraries.map(itinerary => evaluateItinerary(itinerary, requestId)));
}

/**
 * Evaluate a single itinerary
 */
async function evaluateItinerary(
  itinerary: SavedItinerary,
  requestId?: string
): Promise<ScheduledEvaluationResult | null> {
  logger.debug('Itinerary evaluation started', { entryPoint: LOG_ENTRY_POINT }, requestId);

  try {
    const activityCoordinates = extractActivityCoordinates(itinerary);
    if (activityCoordinates.length === 0) {
      logger.debug(
        'Itinerary coordinates defaulted',
        { entryPoint: LOG_ENTRY_POINT, usedDefaultCoordinates: true },
        requestId
      );
      activityCoordinates.push({
        lat: 16.4023,
        lon: 120.5960,
        name: 'Baguio City Center'
      });
    } else {
      logger.debug(
        'Itinerary coordinates resolved',
        { entryPoint: LOG_ENTRY_POINT, activityCount: activityCoordinates.length },
        requestId
      );
    }

    const currentWeather = await fetchWeatherFromAPI();
    if (!currentWeather) {
      logger.warn(
        'Itinerary evaluation skipped',
        { entryPoint: LOG_ENTRY_POINT, reason: 'weather_unavailable' },
        requestId
      );
      return null;
    }

    const evaluation = await itineraryRefreshService.evaluateRefreshNeed(
      itinerary,
      currentWeather,
      activityCoordinates
    );

    const result: ScheduledEvaluationResult = {
      itineraryId: itinerary.id,
      itineraryTitle: itinerary.title,
      needsRefresh: evaluation.needsRefresh,
      severity: evaluation.severity,
      reasons: evaluation.reasons,
      confidence: evaluation.confidence,
      evaluatedAt: new Date()
    };

    logger.info(
      'Itinerary evaluation completed',
      {
        entryPoint: LOG_ENTRY_POINT,
        needsRefresh: evaluation.needsRefresh,
        severity: evaluation.severity,
        confidence: evaluation.confidence,
      },
      requestId
    );

    return result;
  } catch (error) {
    logger.error(
      'Itinerary evaluation failed',
      { entryPoint: LOG_ENTRY_POINT, errorName: error instanceof Error ? error.name : typeof error },
      requestId
    );
    return null;
  }
}

/**
 * Extract activity coordinates from itinerary
 */
function extractActivityCoordinates(
  itinerary: SavedItinerary
): Array<{ lat: number; lon: number; name: string }> {
  // Check if coordinates are already stored
  if (itinerary.activityCoordinates && itinerary.activityCoordinates.length > 0) {
    return itinerary.activityCoordinates;
  }

  const coordinates: Array<{ lat: number; lon: number; name: string }> = [];

  // Extract from itinerary data
  if (itinerary.itineraryData && itinerary.itineraryData.items) {
    for (const period of itinerary.itineraryData.items) {
      for (const activity of period.activities) {
        const activityData = activity as any;
        
        if (activityData.lat && activityData.lon) {
          coordinates.push({
            lat: activityData.lat,
            lon: activityData.lon,
            name: activity.title
          });
        }
      }
    }
  }

  // Remove duplicates
  const uniqueCoordinates = coordinates.filter((coord, index, self) =>
    index === self.findIndex(c => 
      Math.abs(c.lat - coord.lat) < 0.001 && Math.abs(c.lon - coord.lon) < 0.001
    )
  );

  return uniqueCoordinates;
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// MANUAL TRIGGER FUNCTION
// ============================================================================

/**
 * Manually trigger evaluation for a specific itinerary
 */
export async function evaluateSingleItinerary(
  itineraryId: string,
  requestId?: string
): Promise<ScheduledEvaluationResult | null> {
  logger.info('Manual itinerary evaluation started', { entryPoint: LOG_ENTRY_POINT }, requestId);

  try {
    const allItineraries = await getSavedItineraries();
    const itinerary = allItineraries.find(item => item.id === itineraryId);

    if (!itinerary) {
      logger.warn(
        'Manual itinerary lookup completed',
        { entryPoint: LOG_ENTRY_POINT, found: false },
        requestId
      );
      return null;
    }

    logger.info(
      'Manual itinerary lookup completed',
      { entryPoint: LOG_ENTRY_POINT, found: true },
      requestId
    );
    return evaluateItinerary(itinerary, requestId);
  } catch (error) {
    logger.error(
      'Manual itinerary evaluation failed',
      { entryPoint: LOG_ENTRY_POINT, errorName: error instanceof Error ? error.name : typeof error },
      requestId
    );
    return null;
  }
}

// ============================================================================
// NOTIFICATION HELPERS (Optional)
// ============================================================================

/**
 * Send notifications for itineraries needing refresh
 * Can be extended to send emails/push notifications
 */
export async function notifyUsersOfRefreshNeeds(
  results: ScheduledEvaluationResult[],
  requestId?: string
): Promise<void> {
  const needsRefresh = results.filter(result => result.needsRefresh);
  if (needsRefresh.length === 0) {
    logger.info(
      'Refresh notifications prepared',
      { entryPoint: LOG_ENTRY_POINT, count: 0, severityCounts: {} },
      requestId
    );
    return;
  }

  const severityCounts = needsRefresh.reduce<Partial<Record<ScheduledEvaluationResult['severity'], number>>>(
    (counts, result) => {
      counts[result.severity] = (counts[result.severity] ?? 0) + 1;
      return counts;
    },
    {}
  );

  logger.info(
    'Refresh notifications prepared',
    { entryPoint: LOG_ENTRY_POINT, count: needsRefresh.length, severityCounts },
    requestId
  );
}
