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
export async function evaluateAllItineraries(): Promise<SchedulerStats> {
  const startTime = Date.now();
  console.log('\n' + '='.repeat(80));
  console.log('🔄 SCHEDULED REFRESH EVALUATION STARTED');
  console.log('='.repeat(80) + '\n');

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
    // ========================================================================
    // 1. FETCH ALL ITINERARIES
    // ========================================================================
    console.log('📂 Fetching all saved itineraries...');
    const allItineraries = await getSavedItineraries();
    stats.totalItineraries = allItineraries.length;
    console.log(`✅ Found ${stats.totalItineraries} itineraries\n`);

    if (allItineraries.length === 0) {
      console.log('ℹ️ No itineraries to evaluate');
      stats.duration = Date.now() - startTime;
      return stats;
    }

    // ========================================================================
    // 2. FILTER ITINERARIES FOR EVALUATION
    // ========================================================================
    console.log('🔍 Filtering itineraries for evaluation...');
    const itinerariesToEvaluate = filterItinerariesForEvaluation(allItineraries);
    stats.skippedCount = stats.totalItineraries - itinerariesToEvaluate.length;
    
    console.log(`✅ ${itinerariesToEvaluate.length} itineraries to evaluate`);
    console.log(`⏭️ ${stats.skippedCount} itineraries skipped\n`);

    // ========================================================================
    // 3. PROCESS IN BATCHES
    // ========================================================================
    const batches = createBatches(itinerariesToEvaluate, SCHEDULER_CONFIG.batchSize);
    console.log(`📦 Processing ${batches.length} batches (${SCHEDULER_CONFIG.batchSize} per batch)\n`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📦 Processing Batch ${i + 1}/${batches.length} (${batch.length} itineraries)`);
      console.log('─'.repeat(80) + '\n');

      const batchResults = await processBatch(batch);
      
      // Aggregate results
      batchResults.forEach(result => {
        if (result) {
          stats.results.push(result);
          stats.evaluatedCount++;
          if (result.needsRefresh) {
            stats.needsRefreshCount++;
          }
        } else {
          stats.errorCount++;
        }
      });

      // Delay between batches to avoid overload
      if (i < batches.length - 1) {
        console.log(`\n⏳ Waiting ${SCHEDULER_CONFIG.batchDelayMs}ms before next batch...`);
        await delay(SCHEDULER_CONFIG.batchDelayMs);
      }
    }

    // ========================================================================
    // 4. SUMMARY
    // ========================================================================
    stats.duration = Date.now() - startTime;
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ SCHEDULED EVALUATION COMPLETED');
    console.log('='.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   Total Itineraries: ${stats.totalItineraries}`);
    console.log(`   Evaluated: ${stats.evaluatedCount}`);
    console.log(`   Needs Refresh: ${stats.needsRefreshCount}`);
    console.log(`   Skipped: ${stats.skippedCount}`);
    console.log(`   Errors: ${stats.errorCount}`);
    console.log(`   Duration: ${(stats.duration / 1000).toFixed(2)}s\n`);

    if (stats.needsRefreshCount > 0) {
      console.log('🚨 Itineraries needing refresh:');
      stats.results
        .filter(r => r.needsRefresh)
        .forEach(r => {
          console.log(`   - ${r.itineraryTitle} (${r.severity}): ${r.reasons.join(', ')}`);
        });
      console.log('');
    }

    return stats;

  } catch (error) {
    console.error('\n❌ SCHEDULER ERROR:', error);
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
function filterItinerariesForEvaluation(itineraries: SavedItinerary[]): SavedItinerary[] {
  const now = Date.now();
  const evaluationInterval = SCHEDULER_CONFIG.evaluationIntervalHours * 60 * 60 * 1000;

  return itineraries.filter(itinerary => {
    // Skip if auto-refresh disabled
    if (itinerary.refreshMetadata?.autoRefreshEnabled === false) {
      console.log(`⏭️ Skipping ${itinerary.title}: Auto-refresh disabled`);
      return false;
    }

    // Skip if evaluated recently
    const lastEval = itinerary.refreshMetadata?.lastEvaluatedAt;
    if (lastEval) {
      const timeSinceEval = now - new Date(lastEval).getTime();
      if (timeSinceEval < evaluationInterval) {
        const hoursRemaining = ((evaluationInterval - timeSinceEval) / (60 * 60 * 1000)).toFixed(1);
        console.log(`⏭️ Skipping ${itinerary.title}: Evaluated ${hoursRemaining}h ago`);
        return false;
      }
    }

    // Skip if refreshed too many times today
    const refreshCount = itinerary.refreshMetadata?.refreshCount || 0;
    const lastRefresh = itinerary.refreshMetadata?.lastRefreshedAt;
    
    if (lastRefresh) {
      const hoursSinceRefresh = (now - new Date(lastRefresh).getTime()) / (60 * 60 * 1000);
      if (hoursSinceRefresh < 24 && refreshCount >= SCHEDULER_CONFIG.maxRefreshesPerDay) {
        console.log(`⏭️ Skipping ${itinerary.title}: Max refreshes reached (${refreshCount}/${SCHEDULER_CONFIG.maxRefreshesPerDay})`);
        return false;
      }
    }

    // Skip if itinerary is in the past
    const endDate = new Date(itinerary.formData.dates.end);
    if (endDate < new Date()) {
      console.log(`⏭️ Skipping ${itinerary.title}: Trip already completed`);
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
  itineraries: SavedItinerary[]
): Promise<(ScheduledEvaluationResult | null)[]> {
  const promises = itineraries.map(itinerary => evaluateItinerary(itinerary));
  return Promise.all(promises);
}

/**
 * Evaluate a single itinerary
 */
async function evaluateItinerary(
  itinerary: SavedItinerary
): Promise<ScheduledEvaluationResult | null> {
  console.log(`\n🔍 Evaluating: ${itinerary.title}`);

  try {
    // Extract activity coordinates
    const activityCoordinates = extractActivityCoordinates(itinerary);
    
    if (activityCoordinates.length === 0) {
      console.log(`   Using default Baguio coordinates`);
      activityCoordinates.push({ 
        lat: 16.4023, 
        lon: 120.5960, 
        name: 'Baguio City Center' 
      });
    } else {
      console.log(`   Found ${activityCoordinates.length} activity locations`);
    }

    // Fetch current weather
    const currentWeather = await fetchWeatherFromAPI();
    
    if (!currentWeather) {
      console.log(`   ⚠️ Weather data unavailable - skipping`);
      return null;
    }

    console.log(`   Weather: ${currentWeather.weather[0]?.main}, ${currentWeather.main.temp}°C`);

    // Evaluate refresh need
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

    if (evaluation.needsRefresh) {
      console.log(`   🚨 NEEDS REFRESH: ${evaluation.severity} (${evaluation.confidence}% confidence)`);
      console.log(`   Reasons: ${evaluation.reasons.join(', ')}`);
    } else {
      console.log(`   ✅ No refresh needed`);
    }

    return result;

  } catch (error) {
    console.error(`   ❌ Error evaluating ${itinerary.title}:`, error);
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
  itineraryId: string
): Promise<ScheduledEvaluationResult | null> {
  console.log(`\n🔍 Manual evaluation for itinerary: ${itineraryId}\n`);

  try {
    const allItineraries = await getSavedItineraries();
    const itinerary = allItineraries.find(i => i.id === itineraryId);

    if (!itinerary) {
      console.log(`❌ Itinerary not found: ${itineraryId}`);
      return null;
    }

    return await evaluateItinerary(itinerary);

  } catch (error) {
    console.error(`❌ Error in manual evaluation:`, error);
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
  results: ScheduledEvaluationResult[]
): Promise<void> {
  const needsRefresh = results.filter(r => r.needsRefresh);

  if (needsRefresh.length === 0) {
    console.log('ℹ️ No notifications needed');
    return;
  }

  console.log(`\n📧 Sending notifications for ${needsRefresh.length} itineraries...`);

  // TODO: Implement email/push notification logic
  // For now, just log
  needsRefresh.forEach(result => {
    console.log(`   - ${result.itineraryTitle}: ${result.severity} severity`);
  });

  console.log('✅ Notifications sent\n');
}
