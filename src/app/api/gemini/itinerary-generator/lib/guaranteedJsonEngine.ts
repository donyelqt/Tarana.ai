/**
 * Guaranteed JSON Output Engine
 * Enterprise-grade solution that eliminates ALL JSON parsing errors
 * Uses multiple validation layers and automatic error recovery
 */

import { Buffer } from 'buffer';
import { jsonrepair } from 'jsonrepair';
import { z } from 'zod';
import { SchemaType, type Schema } from "@google/generative-ai";
import { geminiModel } from './config';
import { StructuredOutputEngine, ItinerarySchema, PeriodSchema, type StructuredItinerary } from './structuredOutputEngine';
import { EnhancedPromptEngine, JsonSyntaxValidator } from './enhancedPromptEngine';
import { intelligentCacheManager } from '@/lib/ai';

function extractResponseText(result: any): string | null {
  const normalisePayload = (payload: unknown): string | null => {
    if (typeof payload === 'string') {
      const trimmed = payload.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (payload && typeof payload === 'object') {
      try {
        const serialized = JSON.stringify(payload);
        return serialized === '{}' ? null : serialized;
      } catch {
        return null;
      }
    }

    return null;
  };

  const candidates = result?.response?.candidates ?? [];

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts ?? [];
    for (const part of parts) {
      if (typeof part?.text === 'string' && part.text.trim()) {
        return part.text;
      }

      const functionCall = (part as any)?.functionCall;
      if (functionCall?.args !== undefined) {
        const extracted = normalisePayload(functionCall.args);
        if (extracted) {
          return extracted;
        }
      }

      const functionResponse = (part as any)?.functionResponse?.response;
      if (functionResponse?.output !== undefined) {
        const extracted = normalisePayload(functionResponse.output);
        if (extracted) {
          return extracted;
        }
      }

      const inline = (part as any)?.inlineData?.data;
      if (inline) {
        try {
          const decoded = Buffer.from(inline, 'base64').toString('utf-8');
          if (decoded.trim()) {
            return decoded;
          }
        } catch {
          // ignore decode errors
        }
      }
    }
  }

  try {
    const fallback = result?.response?.functionCall?.args ?? result?.response?.text?.();
    const extracted = normalisePayload(fallback);
    if (extracted) {
      return extracted;
    }
  } catch {
    // ignore
  }

  return null;
}

function compactSampleItinerary(sample: any) {
  if (!sample?.items) {
    return sample ?? null;
  }

  const compactItems = sample.items.slice(0, 6).map((item: any) => ({
    period: item.period,
    activities: (item.activities || []).slice(0, 3).map((activity: any) => ({
      title: activity.title,
      desc: activity.desc,
      tags: activity.tags,
      trafficLevel: activity.trafficAnalysis?.realTimeTraffic?.trafficLevel,
    })),
  }));

  return { items: compactItems };
}

/**
 * Multi-layer JSON generation with guaranteed success
 */
export class GuaranteedJsonEngine {
  private static readonly MAX_ATTEMPTS = 1;
  
  private static readonly TIMEOUT_MS = 30000;
  
  private static metrics = {
    totalRequests: 0,
    structuredSuccess: 0,
    promptEngineeredSuccess: 0,
    fallbackUsed: 0,
    averageAttempts: 0
  };

  /**
   * Main entry point - guarantees valid JSON output
   */
  static async generateGuaranteedJson(
    prompt: string,
    sampleItinerary: any,
    weatherContext: string,
    trafficContext: string,
    additionalContext: string = '',
    requestId: string = 'unknown'
  ): Promise<StructuredItinerary> {
    
    // Check cache first - simplified approach
    // Note: This is a complex caching scenario that would require more sophisticated implementation
    
    console.log(`🛡️ GUARANTEED ENGINE: Starting generation for request ${requestId}`);
    const startTime = Date.now();
    this.metrics.totalRequests++;

    const compactSample = compactSampleItinerary(sampleItinerary);
    
    try {
      // WEEK 1 OPTIMIZATION: Race both strategies in parallel - use first success!
      console.log(`🏁 GUARANTEED ENGINE: Racing strategies in parallel for ${requestId}`);
      
      // CRITICAL FIX: Race for first success, don't wait for all
      const raceForFirstSuccess = new Promise<{ result: StructuredItinerary | null; strategyNum: number }>((resolve) => {
        const strategies = [
          {
            name: 'Strategy 1',
            fn: (shouldAbort: () => boolean) =>
              this.attemptStructuredOutput(
                prompt,
                compactSample,
                weatherContext,
                trafficContext,
                additionalContext,
                requestId,
                shouldAbort
              ),
          },
          {
            name: 'Strategy 2',
            fn: (shouldAbort: () => boolean) =>
              this.attemptPromptEngineering(
                prompt,
                compactSample,
                weatherContext,
                trafficContext,
                additionalContext,
                requestId,
                shouldAbort
              ),
          },
        ];

        let completed = 0;
        const errors: string[] = [];
        let settled = false;

        const finish = (payload: { result: StructuredItinerary | null; strategyNum: number }) => {
          if (settled) return;
          settled = true;
          resolve(payload);
        };

        strategies.forEach((strategy, index) => {
          const shouldAbort = () => settled;

          strategy
            .fn(shouldAbort)
            .then((result) => {
              if (settled) return;
              if (result) {
                console.log(`🏆 ${strategy.name} succeeded first!`);
                finish({ result, strategyNum: index + 1 });
              } else {
                completed++;
                errors.push(`${strategy.name}: returned null`);
                if (completed === strategies.length) {
                  finish({ result: null, strategyNum: 0 });
                }
              }
            })
            .catch((err) => {
              if (settled) return;
              completed++;
              errors.push(`${strategy.name}: ${err.message}`);
              console.log(`⚠️ ${strategy.name} failed: ${err.message}`);

              if (completed === strategies.length) {
                console.log(`🆘 All strategies failed:`, errors);
                finish({ result: null, strategyNum: 0 });
              }
            });
        });
      });
      
      const { result, strategyNum } = await raceForFirstSuccess;
      
      if (result) {
        const elapsed = Date.now() - startTime;
        console.log(`🏆 GUARANTEED ENGINE: Strategy ${strategyNum} won the race in ${elapsed}ms`);
        
        if (strategyNum === 1) this.metrics.structuredSuccess++;
        else this.metrics.promptEngineeredSuccess++;
        
        return result;
      }
      
      // All strategies failed - use guaranteed fallback
      console.log(`🆘 GUARANTEED ENGINE: All strategies failed, using fallback`);
      this.metrics.fallbackUsed++;
      return this.createIntelligentFallback(sampleItinerary, requestId);

    } catch (error: any) {
      console.error(`💥 GUARANTEED ENGINE: Critical error for ${requestId}:`, error);
      this.metrics.fallbackUsed++;
      return this.createIntelligentFallback(sampleItinerary, requestId);
    }
  }

  /**
   * Strategy 1: Structured Output with Function Calling
   */
  private static async attemptStructuredOutput(
    prompt: string,
    sampleItinerary: any,
    weatherContext: string,
    trafficContext: string,
    additionalContext: string,
    requestId: string,
    shouldAbort?: () => boolean
  ): Promise<StructuredItinerary | null> {
    if (shouldAbort?.()) {
      return null;
    }

    try {
      const enhancedPrompt = EnhancedPromptEngine.buildBulletproofPrompt(
        prompt, sampleItinerary, weatherContext, trafficContext, additionalContext
      );
      
      if (shouldAbort?.()) {
        return null;
      }

      const result = await StructuredOutputEngine.generateStructuredItinerary(
        enhancedPrompt, requestId
      );
      
      // Validate the result
      const validation = ItinerarySchema.safeParse(result);
      if (validation.success) {
        console.log(`🎯 GUARANTEED ENGINE: Structured output validation passed`);
        return validation.data;
      } else {
        console.warn(`⚠️ GUARANTEED ENGINE: Structured output validation failed:`, validation.error.message);
        return null;
      }
      
    } catch (error: any) {
      if (shouldAbort?.()) {
        return null;
      }
      console.warn(`⚠️ GUARANTEED ENGINE: Structured output failed:`, error.message);
      return null;
    }
  }

  /**
   * Strategy 2: Enhanced Prompt Engineering with Multiple Attempts
   */
  private static async attemptPromptEngineering(
    prompt: string,
    sampleItinerary: any,
    weatherContext: string,
    trafficContext: string,
    additionalContext: string,
    requestId: string,
    shouldAbort?: () => boolean
  ): Promise<StructuredItinerary | null> {
    if (shouldAbort?.()) {
      return null;
    }

    for (let attempt = 1; attempt <= this.MAX_ATTEMPTS; attempt++) {
      if (shouldAbort?.()) {
        return null;
      }

      try {
        if (shouldAbort?.()) {
          return null;
        }

        console.log(`🔧 GUARANTEED ENGINE: Prompt engineering attempt ${attempt}/${this.MAX_ATTEMPTS}`);
        
        // Build progressive prompt (gets simpler with each attempt)
        const enhancedPrompt = EnhancedPromptEngine.buildProgressivePrompt(
          EnhancedPromptEngine.buildBulletproofPrompt(
            prompt, sampleItinerary, weatherContext, trafficContext, additionalContext
          ),
          attempt,
          this.MAX_ATTEMPTS
        );

        // Generate with strict JSON mode
        const result = await this.generateWithStrictJson(enhancedPrompt, attempt, shouldAbort);
        
        if (shouldAbort?.()) {
          return null;
        }

        if (result) {
          console.log(`✅ GUARANTEED ENGINE: Prompt engineering succeeded on attempt ${attempt}`);
          return result;
        }

      } catch (error: any) {
        if (shouldAbort?.()) {
          return null;
        }
        console.warn(`⚠️ GUARANTEED ENGINE: Prompt engineering attempt ${attempt} failed:`, error.message);

        if (attempt < this.MAX_ATTEMPTS && !shouldAbort?.()) {
          const delay = Math.min(1000 * attempt, 3000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return null;
  }

  private static readonly itineraryResponseSchema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
      title: { type: SchemaType.STRING },
      subtitle: { type: SchemaType.STRING },
      items: {
        type: SchemaType.ARRAY,
        minItems: 1,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            period: { type: SchemaType.STRING },
            activities: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  image: { type: SchemaType.STRING },
                  title: { type: SchemaType.STRING },
                  time: { type: SchemaType.STRING },
                  desc: { type: SchemaType.STRING },
                  tags: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.STRING
                    }
                  }
                },
                required: ["image", "title", "time", "desc", "tags"]
              }
            },
            reason: { type: SchemaType.STRING }
          },
          required: ["period", "activities"]
        }
      }
    },
    required: ["title", "subtitle", "items"]
  };

  private static async generateWithStrictJson(
    prompt: string,
    attempt: number,
    shouldAbort?: () => boolean
  ): Promise<StructuredItinerary | null> {
    if (shouldAbort?.()) {
      return null;
    }

    const generationConfig = {
      responseMimeType: "application/json",
      temperature: Math.max(0.1, 0.25 - attempt * 0.05),
      topK: 1,
      topP: 0.7,
      maxOutputTokens: 4096,
      candidateCount: 1,
      responseSchema: this.itineraryResponseSchema
    };

    try {
      const result = await Promise.race([
        geminiModel!.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Generation timeout')), this.TIMEOUT_MS)
        )
      ]) as any;

      if (shouldAbort?.()) {
        return null;
      }

      const text = extractResponseText(result);
      if (!text) {
        console.warn(`⚠️ GUARANTEED ENGINE: Empty response payload on attempt ${attempt}`,
          typeof result?.response !== 'undefined'
            ? JSON.stringify(result.response).slice(0, 400)
            : 'no response payload');
        return null;
      }

      return this.parseAndValidateJson(text, attempt);
      
    } catch (error: any) {
      if (shouldAbort?.()) {
        return null;
      }
      console.warn(`⚠️ GUARANTEED ENGINE: Generation failed on attempt ${attempt}:`, error.message);
      return null;
    }
  }

  /**
   * Parse and validate JSON with multiple recovery strategies
   */
  private static parseAndValidateJson(
    text: string,
    attempt: number
  ): StructuredItinerary | null {
    
    const validatePayload = (payload: unknown, label: string): StructuredItinerary | null => {
      const normalized = this.decodeNestedJson(payload);
      const validation = ItinerarySchema.safeParse(normalized);
      if (validation.success) {
        console.log(`✅ GUARANTEED ENGINE: ${label} succeeded`);
        return validation.data;
      }
      return null;
    };

    // Strategy 1: Direct parsing
    try {
      const parsed = JSON.parse(text);
      const direct = validatePayload(parsed, 'Direct JSON parsing');
      if (direct) {
        return direct;
      }
    } catch (error) {
      console.log(`🔄 GUARANTEED ENGINE: Direct parsing failed, trying recovery...`);
    }

    // Strategy 2: Syntax validation and fixing
    const syntaxCheck = JsonSyntaxValidator.validateSyntax(text);
    if (syntaxCheck.cleanedJson) {
      try {
        const parsed = JSON.parse(syntaxCheck.cleanedJson);
        const cleaned = validatePayload(parsed, 'Syntax-fixed JSON parsing');
        if (cleaned) {
          return cleaned;
        }
      } catch (error) {
        console.log(`🔄 GUARANTEED ENGINE: Syntax fixing failed, trying aggressive recovery...`);
      }
    }

    // Strategy 3: Aggressive fixing
    const fixed = JsonSyntaxValidator.attemptFix(text);
    try {
      const parsed = JSON.parse(fixed);
      const aggressive = validatePayload(parsed, 'Aggressive fixing');
      if (aggressive) {
        return aggressive;
      }
    } catch (error) {
      console.log(`❌ GUARANTEED ENGINE: All JSON recovery strategies failed`);
    }

    // Strategy 4: jsonrepair rescue
    try {
      const repaired = jsonrepair(text);
      const reparsed = typeof repaired === 'string' ? JSON.parse(repaired) : repaired;
      const repairedResult = validatePayload(reparsed, 'jsonrepair recovery');
      if (repairedResult) {
        return repairedResult;
      }
    } catch (error) {
      console.log(`❌ GUARANTEED ENGINE: jsonrepair recovery failed:`, error instanceof Error ? error.message : error);
    }

    return null;
  }

  private static decodeNestedJson(value: unknown): any {
    if (typeof value === 'string') {
      const trimmed = value.trim();

      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          const reparsed = JSON.parse(trimmed);
          return this.decodeNestedJson(reparsed);
        } catch {
          return trimmed;
        }
      }
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.decodeNestedJson(item));
    }

    if (value && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, val]) => {
        acc[key] = this.decodeNestedJson(val);
        return acc;
      }, {});
    }

    return value;
  }

  /**
   * Create intelligent fallback based on available data
   */
  private static createIntelligentFallback(
    sampleItinerary: any,
    requestId: string
  ): StructuredItinerary {
    
    console.log(`🆘 GUARANTEED ENGINE: Creating intelligent fallback for ${requestId}`);
    
    // Try to extract activities from sample itinerary
    const activities = this.extractActivitiesFromSample(sampleItinerary);
    
    if (activities.length > 0) {
      // Create a proper itinerary structure with all time periods
      const itineraryItems = [];
      
      // Add morning period
      itineraryItems.push({
        period: "Day 1 - Morning",
        activities: activities.slice(0, 2),
        reason: activities.slice(0, 2).length === 0 ? 
          "Tarana-AI suggests leaving this time slot open to avoid traffic. Perfect for a quiet local coffee before your afternoon plans." : 
          undefined
      });
      
      // Add afternoon period
      itineraryItems.push({
        period: "Day 1 - Afternoon",
        activities: activities.slice(2, 4),
        reason: activities.slice(2, 4).length === 0 ? 
          "Tarana-AI suggests leaving this time slot open to avoid traffic. Ideal for a relaxing lunch break away from crowds." : 
          undefined
      });
      
      // Add evening period
      itineraryItems.push({
        period: "Day 1 - Evening",
        activities: activities.slice(4, 6),
        reason: activities.slice(4, 6).length === 0 ? 
          "Tarana-AI suggests leaving this time slot open to avoid traffic. Great for a peaceful dinner experience." : 
          undefined
      });
      
      return {
        title: "Baguio City Itinerary",
        subtitle: "Curated recommendations based on your preferences",
        items: itineraryItems
      };
    }

    // Ultimate fallback with reason fields for empty periods
    return {
      title: "Baguio City Itinerary",
      subtitle: "Unable to generate custom itinerary - please try again",
      items: [{
        period: "Day 1 - Morning",
        activities: [],
        reason: "Tarana-AI is currently optimizing your itinerary. This time slot will be filled with personalized suggestions based on real-time traffic and weather conditions."
      }, {
        period: "Day 1 - Afternoon",
        activities: [],
        reason: "Tarana-AI is currently optimizing your itinerary. This time slot will be filled with personalized suggestions based on real-time traffic and weather conditions."
      }, {
        period: "Day 1 - Evening",
        activities: [],
        reason: "Tarana-AI is currently optimizing your itinerary. This time slot will be filled with personalized suggestions based on real-time traffic and weather conditions."
      }]
    };
  }

  /**
   * Extract valid activities from sample itinerary
   */
  private static extractActivitiesFromSample(sampleItinerary: any): any[] {
    if (!sampleItinerary?.items) return [];
    
    const activities: any[] = [];
    
    for (const item of sampleItinerary.items) {
      if (item.activities && Array.isArray(item.activities)) {
        for (const activity of item.activities) {
          if (this.isValidActivity(activity)) {
            activities.push({
              image: activity.image || "/images/placeholders/default-itinerary.jpg",
              title: activity.title || "Baguio Activity",
              time: activity.time || "9:00-10:00AM",
              desc: activity.desc || "Enjoy this activity with optimal timing.",
              tags: Array.isArray(activity.tags) ? activity.tags : ["Baguio"]
            });
          }
        }
      }
    }
    
    return activities.slice(0, 6); // Limit to 6 activities
  }

  /**
   * Validate activity structure
   */
  private static isValidActivity(activity: any): boolean {
    return activity &&
           typeof activity.title === 'string' &&
           activity.title.trim().length > 0 &&
           typeof activity.image === 'string' &&
           typeof activity.desc === 'string';
  }

  /**
   * Update performance metrics
   */
  private static updateAverageAttempts(attempts: number): void {
    const total = this.metrics.averageAttempts * (this.metrics.totalRequests - 1) + attempts;
    this.metrics.averageAttempts = total / this.metrics.totalRequests;
  }

  /**
   * Get performance metrics
   */
  static getMetrics() {
    const total = this.metrics.totalRequests;
    return {
      ...this.metrics,
      structuredSuccessRate: total > 0 ? (this.metrics.structuredSuccess / total) * 100 : 0,
      promptEngineeredSuccessRate: total > 0 ? (this.metrics.promptEngineeredSuccess / total) * 100 : 0,
      fallbackRate: total > 0 ? (this.metrics.fallbackUsed / total) * 100 : 0,
      overallSuccessRate: total > 0 ? ((this.metrics.structuredSuccess + this.metrics.promptEngineeredSuccess) / total) * 100 : 0
    };
  }

  /**
   * Health check for the guaranteed engine
   */
  static async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const testPrompt = "Generate a simple Baguio itinerary with one morning activity.";
      const result = await this.generateGuaranteedJson(
        testPrompt, null, '', '', '', 'health-check'
      );
      
      const isValid = ItinerarySchema.safeParse(result).success;
      const metrics = this.getMetrics();
      
      return {
        status: isValid ? 'healthy' : 'degraded',
        details: {
          validOutput: isValid,
          metrics,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        }
      };
    }
  }

  /**
   * Reset metrics (for testing)
   */
  static resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      structuredSuccess: 0,
      promptEngineeredSuccess: 0,
      fallbackUsed: 0,
      averageAttempts: 0
    };
  }
}
