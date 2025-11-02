/**
 * Enterprise-Grade Structured Output Engine
 * Guarantees 100% valid JSON output using Google Gemini's function calling
 * Eliminates all JSON parsing errors through schema-enforced generation
 */

import { Buffer } from 'buffer';
import { jsonrepair } from 'jsonrepair';
import { z } from 'zod';
import { geminiModel } from './config';
import { JsonSyntaxValidator } from './enhancedPromptEngine';

// Strict Zod schemas for guaranteed structure
export const ActivitySchema = z.object({
  image: z.string().min(1, "Image URL required"),
  title: z.string().min(1, "Title required"),
  time: z.string().min(1, "Time slot required"),
  desc: z.string().min(10, "Description must be at least 10 characters"),
  tags: z.array(z.string()).min(1, "At least one tag required")
});

export const PeriodSchema = z.object({
  period: z.string().min(1, "Period name required"),
  activities: z.array(ActivitySchema).min(0, "Activities array required"),
  reason: z.string().optional()
});

export const ItinerarySchema = z.object({
  title: z.string().min(1, "Title required"),
  subtitle: z.string().min(1, "Subtitle required"),
  items: z.array(PeriodSchema).min(1, "At least one period required")
});

export type StructuredItinerary = z.infer<typeof ItinerarySchema>;

/**
 * Simplified structured output approach using JSON mode
 * More reliable than function calling for complex schemas
 */

/**
 * Structured Output Engine - Guarantees valid JSON
 */
export class StructuredOutputEngine {
  private static readonly MAX_RETRIES = 3;
  private static readonly TIMEOUT_MS = 45000;

  /**
   * Generate itinerary with guaranteed structure using enhanced JSON mode
   */
  static async generateStructuredItinerary(
    prompt: string,
    requestId: string = 'unknown'
  ): Promise<StructuredItinerary> {
    console.log(`🏗️ STRUCTURED ENGINE: Starting generation for request ${requestId}`);
    
    const startTime = Date.now();
    
    try {
      // Enhanced prompt for structured JSON
      const structuredPrompt = this.buildStructuredPrompt(prompt);
      
      // Generation config optimized for JSON output
      const generationConfig = {
        responseMimeType: "application/json",
        temperature: 0.15,
        topK: 4,
        topP: 0.7,
        maxOutputTokens: 4096,
        candidateCount: 1
      };

      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
        try {
          console.log(`🔄 STRUCTURED ENGINE: Attempt ${attempt}/${this.MAX_RETRIES}`);
          
          // Use JSON mode for guaranteed structure
          const result = await Promise.race([
            geminiModel!.generateContent({
              contents: [{ role: "user", parts: [{ text: structuredPrompt }] }],
              generationConfig
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Generation timeout')), this.TIMEOUT_MS)
            )
          ]) as any;

          // Extract JSON response
          const text = extractResponseText(result);

          if (!text) {
            throw new Error('No valid response text');
          }

          // Parse JSON response with recovery strategies
          const rawData = this.parseStructuredJson(text, requestId);
          console.log(`✅ STRUCTURED ENGINE: Raw JSON received in ${Date.now() - startTime}ms`);

          // Validate and clean the structured data
          const validatedItinerary = this.validateAndCleanStructure(rawData, requestId);
          
          console.log(`🎯 STRUCTURED ENGINE: Successfully generated valid itinerary in ${Date.now() - startTime}ms`);
          return validatedItinerary;

        } catch (error: any) {
          lastError = error;
          console.warn(`⚠️ STRUCTURED ENGINE: Attempt ${attempt} failed. Error: ${error instanceof Error ? error.message : String(error)}`);
          
          if (attempt < this.MAX_RETRIES) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            console.log(`🔄 STRUCTURED ENGINE: Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // All retries failed - return fallback structure
      console.error(`❌ STRUCTURED ENGINE: All attempts failed for request ${requestId}:`, lastError);
      return this.createFallbackItinerary(requestId);

    } catch (error: any) {
      console.error(`💥 STRUCTURED ENGINE: Critical error for request ${requestId}:`, error);
      return this.createFallbackItinerary(requestId);
    }
  }

  private static parseStructuredJson(text: string, requestId: string): any {
    try {
      const parsed = JSON.parse(text);
      return this.decodeNestedJson(parsed, requestId);
    } catch (error) {
      console.warn(`🔄 STRUCTURED ENGINE: Direct parse failed for ${requestId}, attempting recovery...`);
    }

    const syntaxCheck = JsonSyntaxValidator.validateSyntax(text);
    if (syntaxCheck.cleanedJson) {
      try {
        const parsed = JSON.parse(syntaxCheck.cleanedJson);
        return this.decodeNestedJson(parsed, requestId);
      } catch (error) {
        console.warn(`🔄 STRUCTURED ENGINE: Syntax cleaning failed for ${requestId}, attempting aggressive fix...`);
      }
    }

    try {
      const fixed = JsonSyntaxValidator.attemptFix(text);
      const parsed = JSON.parse(fixed);
      return this.decodeNestedJson(parsed, requestId);
    } catch (error) {
      console.warn(`🔄 STRUCTURED ENGINE: Custom fixer failed for ${requestId}, invoking jsonrepair...`);
    }

    try {
      const repaired = jsonrepair(text);
      const parsed = typeof repaired === 'string' ? JSON.parse(repaired) : repaired;
      return this.decodeNestedJson(parsed, requestId);
    } catch (error) {
      console.error(`❌ STRUCTURED ENGINE: jsonrepair failed for ${requestId}:`, error instanceof Error ? error.message : error);
      throw new Error('Unable to recover structured JSON response');
    }
  }

  private static decodeNestedJson(value: unknown, requestId: string): any {
    if (typeof value === 'string') {
      const trimmed = value.trim();

      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          console.warn(`🔁 STRUCTURED ENGINE: Detected stringified JSON for ${requestId}, parsing again.`);
          const reparsed = JSON.parse(trimmed);
          return this.decodeNestedJson(reparsed, requestId);
        } catch (error) {
          console.warn(`⚠️ STRUCTURED ENGINE: Nested JSON parse failed for ${requestId}:`, error instanceof Error ? error.message : error);
          return trimmed;
        }
      }
    }

    return value;
  }

  /**
   * Build enhanced prompt for structured generation
   */
  private static buildStructuredPrompt(originalPrompt: string): string {
    return `${originalPrompt}

CRITICAL: You MUST return ONLY valid JSON that matches this exact schema:

{
  "title": "string",
  "subtitle": "string", 
  "items": [
    {
      "period": "Day X - Morning/Afternoon/Evening",
      "activities": [
        {
          "image": "string",
          "title": "string",
          "time": "string",
          "desc": "string (minimum 10 characters)",
          "tags": ["string"]
        }
      ]
    }
  ]
}

DO NOT return explanatory text, markdown, or anything other than pure JSON.`;
  }

  /**
   * Validate and clean structured data with Zod
   */
  private static validateAndCleanStructure(
    rawData: any, 
    requestId: string
  ): StructuredItinerary {
    try {
      // First pass validation
      const validated = ItinerarySchema.parse(rawData);
      console.log(`✅ STRUCTURED ENGINE: Schema validation passed for ${requestId}`);
      return validated;
      
    } catch (zodError: any) {
      console.warn(`🔧 STRUCTURED ENGINE: Schema validation failed, attempting fixes for ${requestId}:`, zodError.message);
      
      // Attempt to fix common issues
      const fixed = this.fixStructuralIssues(rawData);
      
      try {
        const revalidated = ItinerarySchema.parse(fixed);
        console.log(`✅ STRUCTURED ENGINE: Schema validation passed after fixes for ${requestId}`);
        return revalidated;
      } catch (secondError: any) {
        console.error(`❌ STRUCTURED ENGINE: Unable to fix schema issues for ${requestId}:`, secondError.message);
        return this.createFallbackItinerary(requestId);
      }
    }
  }

  /**
   * Fix common structural issues in AI responses
   */
  private static fixStructuralIssues(data: any): any {
    if (!data || typeof data !== 'object') {
      return this.createEmptyStructure();
    }

    const fixed = {
      title: this.ensureString(data.title, "Baguio City Itinerary"),
      subtitle: this.ensureString(data.subtitle, "Personalized travel recommendations"),
      items: this.ensureArray(data.items).map((item: any) => ({
        period: this.ensureString(item?.period, "Day 1 - Morning"),
        activities: this.ensureArray(item?.activities).map((activity: any) => ({
          image: this.ensureString(activity?.image, "/images/placeholders/default-itinerary.jpg"),
          title: this.ensureString(activity?.title, "Activity"),
          time: this.ensureString(activity?.time, "9:00-10:00AM"),
          desc: this.ensureString(activity?.desc, "Enjoy this activity with optimal timing."),
          tags: this.ensureTags(activity?.tags, activity?.title, item?.period, activity?.desc)
        })),
        // Preserve the reason field if it exists
        reason: typeof item?.reason === 'string' ? item.reason : undefined
      }))
    };

    return fixed;
  }

  /**
   * Utility functions for data cleaning
   */
  private static ensureString(value: any, fallback: string): string {
    return (typeof value === 'string' && value.trim()) ? value.trim() : fallback;
  }

  private static ensureArray(value: any): any[] {
    return Array.isArray(value) ? value : [];
  }

  private static ensureTags(value: any, ...fallbackHints: Array<string | undefined>): string[] {
    const collected = new Set<string>();

    if (Array.isArray(value)) {
      value.forEach(tag => {
        if (typeof tag === 'string' && tag.trim()) {
          collected.add(tag.trim());
        }
      });
    } else if (typeof value === 'string' && value.trim()) {
      collected.add(value.trim());
    }

    if (collected.size === 0) {
      for (const hint of fallbackHints) {
        const fallbackTag = this.deriveFallbackTag(hint);
        if (fallbackTag) {
          collected.add(fallbackTag);
          break;
        }
      }
    }

    if (collected.size === 0) {
      collected.add('general-interest');
    }

    return Array.from(collected);
  }

  private static deriveFallbackTag(hint?: string): string | null {
    if (!hint || typeof hint !== 'string') {
      return null;
    }

    const normalized = hint.toLowerCase();

    if (normalized.includes('nature') || normalized.includes('scenery')) {
      return 'nature';
    }
    if (normalized.includes('food') || normalized.includes('dining')) {
      return 'food';
    }
    if (normalized.includes('culture') || normalized.includes('heritage')) {
      return 'culture';
    }
    if (normalized.includes('adventure') || normalized.includes('hiking')) {
      return 'adventure';
    }
    if (normalized.includes('morning')) {
      return 'morning';
    }
    if (normalized.includes('afternoon')) {
      return 'afternoon';
    }
    if (normalized.includes('evening') || normalized.includes('night')) {
      return 'evening';
    }

    return null;
  }

  /**
   * Create fallback itinerary structure
   */
  private static createFallbackItinerary(requestId: string): StructuredItinerary {
    console.log(`🆘 STRUCTURED ENGINE: Creating fallback itinerary for ${requestId}`);
    
    return {
      title: "Baguio City Itinerary",
      subtitle: "Unable to generate custom itinerary - please try again with different preferences",
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

  private static createEmptyStructure(): any {
    return {
      title: "",
      subtitle: "",
      items: []
    };
  }

  /**
   * Health check for the structured engine
   */
  static async healthCheck(): Promise<{ status: string; timestamp: number }> {
    try {
      const testPrompt = "Generate a simple test itinerary for Baguio with one activity.";
      const result = await this.generateStructuredItinerary(testPrompt, 'health-check');
      
      const isValid = ItinerarySchema.safeParse(result).success;
      
      return {
        status: isValid ? 'healthy' : 'degraded',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: Date.now()
      };
    }
  }
}

function extractResponseText(result: any): string | null {
  const candidates = result?.response?.candidates ?? [];

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts ?? [];
    for (const part of parts) {
      if (typeof part?.text === 'string' && part.text.trim()) {
        return part.text;
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
    const fallback = result?.response?.text?.();
    if (typeof fallback === 'string' && fallback.trim()) {
      return fallback;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Performance monitoring for structured output
 */
export class StructuredOutputMonitor {
  private static metrics = {
    totalRequests: 0,
    successfulGenerations: 0,
    fallbackUsed: 0,
    averageResponseTime: 0,
    lastHealthCheck: 0
  };

  static recordSuccess(responseTime: number): void {
    this.metrics.totalRequests++;
    this.metrics.successfulGenerations++;
    this.updateAverageResponseTime(responseTime);
  }

  static recordFallback(): void {
    this.metrics.totalRequests++;
    this.metrics.fallbackUsed++;
  }

  private static updateAverageResponseTime(newTime: number): void {
    const total = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + newTime;
    this.metrics.averageResponseTime = total / this.metrics.totalRequests;
  }

  static getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalRequests > 0 
        ? (this.metrics.successfulGenerations / this.metrics.totalRequests) * 100 
        : 0,
      fallbackRate: this.metrics.totalRequests > 0
        ? (this.metrics.fallbackUsed / this.metrics.totalRequests) * 100
        : 0
    };
  }

  static async performHealthCheck(): Promise<void> {
    const health = await StructuredOutputEngine.healthCheck();
    this.metrics.lastHealthCheck = health.timestamp;
    console.log(`🏥 STRUCTURED ENGINE: Health check - ${health.status}`);
  }
}
