import { ItinerarySchema } from "../types/schemas";
import { logger } from "../../../../../lib/observability/logger";

export class RobustJsonParser {
  private static readonly MAX_ATTEMPTS = 6;
  private static readonly FALLBACK_ITINERARY = {
    title: "Baguio City Itinerary",
    subtitle: "Generated with limited data - please try again",
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

  static parseResponse(text: string): any {
    if (!text || typeof text !== 'string') {
      logger.warn("RobustJsonParser: Empty or invalid text provided", { entryPoint: 'robustJsonParser' });
      return this.FALLBACK_ITINERARY;
    }

    const strategies = [
      () => this.strategy1_DirectParse(text),
      () => this.strategy2_ExtractCodeBlock(text),
      () => this.strategy3_ExtractBraces(text),
      () => this.strategy4_FixCommonErrors(text),
      () => this.strategy5_AggressiveClean(text),
      () => this.strategy6_StructuralFix(text)
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const result = strategies[i]();
        if (result) {
          const validated = this.validateAndFix(result);
          if (validated) {
            logger.info(`RobustJsonParser: Success with strategy ${i + 1}`, { entryPoint: 'robustJsonParser' });
            return validated;
          }
        }
      } catch (error) {
        logger.warn(`RobustJsonParser: Strategy ${i + 1} failed:`, { entryPoint: 'robustJsonParser', error: error instanceof Error ? error.message : String(error) });
      }
    }

    logger.error("RobustJsonParser: All strategies failed, returning fallback", { entryPoint: 'robustJsonParser' });
    return this.FALLBACK_ITINERARY;
  }

  private static strategy1_DirectParse(text: string): any {
    return JSON.parse(text);
  }

  private static strategy2_ExtractCodeBlock(text: string): any {
    const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/gi;
    const matches = text.match(codeBlockRegex);
    
    if (matches && matches.length > 0) {
      for (const match of matches) {
        const content = match.replace(/```(?:json)?\s*\n?/gi, '').replace(/\n?\s*```/g, '');
        try {
          return JSON.parse(content);
        } catch (e) {
          continue;
        }
      }
    }
    throw new Error("No valid JSON in code blocks");
  }

  private static strategy3_ExtractBraces(text: string): any {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonStr = text.slice(firstBrace, lastBrace + 1);
      return JSON.parse(jsonStr);
    }
    throw new Error("No valid braces found");
  }

  private static strategy4_FixCommonErrors(text: string): any {
    let cleaned = text;
    
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
    
    cleaned = cleaned
      .replace(/,(\s*[}\]])/g, '$1')           
      .replace(/([{,]\s*)(\w+):/g, '$1"$2":') 
      .replace(/:\s*'([^']*)'/g, ': "$1"')     
      .replace(/\\'/g, "'")                    
      .replace(/\n/g, ' ')                     
      .replace(/\s+/g, ' ')                    
      .trim();
    
    return JSON.parse(cleaned);
  }

  private static strategy5_AggressiveClean(text: string): any {
    let cleaned = text;
    
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace > 0) {
      cleaned = cleaned.substring(firstBrace);
    }
    
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace !== -1 && lastBrace < cleaned.length - 1) {
      cleaned = cleaned.substring(0, lastBrace + 1);
    }
    
    cleaned = cleaned
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') 
      .replace(/,(\s*[}\]])/g, '$1')                
      .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":') 
      .replace(/:\s*'([^']*)'/g, ': "$1"')          
      .replace(/:\s*([^",{\[\]}\s]+)(\s*[,}\]])/g, ': "$1"$2') 
      .replace(/\s+/g, ' ')                         
      .trim();
    
    return JSON.parse(cleaned);
  }

  private static strategy6_StructuralFix(text: string): any {
    const titleMatch = text.match(/"title"\s*:\s*"([^"]+)"/);
    const subtitleMatch = text.match(/"subtitle"\s*:\s*"([^"]+)"/);
    
    if (titleMatch || subtitleMatch) {
      return {
        title: titleMatch ? titleMatch[1] : "Baguio City Itinerary",
        subtitle: subtitleMatch ? subtitleMatch[1] : "Please try generating again",
        items: []
      };
    }
    
    throw new Error("Could not reconstruct structure");
  }

  private static validateAndFix(parsed: any): any {
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const fixed = {
      title: parsed.title || "Baguio City Itinerary",
      subtitle: parsed.subtitle || "Generated itinerary",
      items: Array.isArray(parsed.items) ? parsed.items : []
    };

    const validationResult = ItinerarySchema.safeParse(fixed);
    
    if (validationResult.success) {
      return validationResult.data;
    } else {
      logger.warn("RobustJsonParser: Schema validation failed, attempting fixes", { entryPoint: 'robustJsonParser' });
      
      if (fixed.items.length > 0) {
        fixed.items = fixed.items.map((item: any) => {
          if (!item || typeof item !== 'object') return null;
          
          return {
            day: item.day || item.title || "Day 1",
            activities: Array.isArray(item.activities) ? item.activities.map((activity: any) => {
              if (!activity || typeof activity !== 'object') return null;
              
              return {
                title: activity.title || "Activity",
                description: activity.description || "No description available",
                duration: activity.duration || "1 hour",
                tags: Array.isArray(activity.tags) ? activity.tags : [],
                image: activity.image || "default",
                peakHours: activity.peakHours || "N/A"
              };
            }).filter(Boolean) : [],
            reason: typeof item.reason === 'string' ? item.reason : undefined
          };
        }).filter(Boolean);
      }
      
      const finalValidation = ItinerarySchema.safeParse(fixed);
      return finalValidation.success ? finalValidation.data : null;
    }
  }
}
