
import { ResultMatch } from "@/types/tarana-eats";
import { logger } from "@/lib/observability/logger";

const PARSER_ENTRY_POINT = 'robust-food-json-parser';

interface EnhancedResultMatch extends ResultMatch {
  fullMenu?: any;
  reason?: string;
}

interface ParseResult {
  success: boolean;
  data: { matches: EnhancedResultMatch[] } | null;
  strategy: string;
  error?: string;
}

export class RobustFoodJsonParser {
  private static readonly STRATEGIES = [
    'direct_parse',
    'extract_code_blocks', 
    'extract_braces',
    'fix_common_errors',
    'aggressive_cleaning',
    'structural_reconstruction'
  ];

  static parseResponse(response: string): ParseResult {
    logger.info('RobustFoodJsonParser: Starting parse', { entryPoint: PARSER_ENTRY_POINT, responseLength: response.length });
    
    for (const strategy of this.STRATEGIES) {
      try {
        const result = this.executeStrategy(strategy, response);
        if (result.success) {
          logger.info('RobustFoodJsonParser: Parse succeeded', { entryPoint: PARSER_ENTRY_POINT, strategy });
          return result;
        }
      } catch (error) {
        logger.warn(`RobustFoodJsonParser: Strategy '${strategy}' failed`, { entryPoint: PARSER_ENTRY_POINT, strategy, error: error instanceof Error ? error.message : String(error) });
        continue;
      }
    }

    logger.warn('RobustFoodJsonParser: All strategies failed; returning empty structure', { entryPoint: PARSER_ENTRY_POINT });
    return {
      success: true,
      data: { matches: [] },
      strategy: 'empty_fallback'
    };
  }

  private static executeStrategy(strategy: string, response: string): ParseResult {
    switch (strategy) {
      case 'direct_parse':
        return this.directParse(response);
      case 'extract_code_blocks':
        return this.extractFromCodeBlocks(response);
      case 'extract_braces':
        return this.extractBetweenBraces(response);
      case 'fix_common_errors':
        return this.fixCommonErrors(response);
      case 'aggressive_cleaning':
        return this.aggressiveCleaning(response);
      case 'structural_reconstruction':
        return this.structuralReconstruction(response);
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  }

  private static directParse(response: string): ParseResult {
    const cleaned = response.trim();
    const parsed = JSON.parse(cleaned);
    const validated = this.validateAndNormalize(parsed);
    
    return {
      success: true,
      data: validated,
      strategy: 'direct_parse'
    };
  }

  private static extractFromCodeBlocks(response: string): ParseResult {
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/g;
    const matches = [...response.matchAll(codeBlockRegex)];
    
    for (const match of matches) {
      try {
        const jsonStr = match[1].trim();
        const parsed = JSON.parse(jsonStr);
        const validated = this.validateAndNormalize(parsed);
        
        return {
          success: true,
          data: validated,
          strategy: 'extract_code_blocks'
        };
      } catch (error) {
        continue;
      }
    }
    
    throw new Error('No valid JSON found in code blocks');
  }

  private static extractBetweenBraces(response: string): ParseResult {
    const firstBrace = response.indexOf('{');
    const lastBrace = response.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      throw new Error('No valid brace pair found');
    }
    
    const jsonStr = response.substring(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonStr);
    const validated = this.validateAndNormalize(parsed);
    
    return {
      success: true,
      data: validated,
      strategy: 'extract_braces'
    };
  }

  private static fixCommonErrors(response: string): ParseResult {
    let jsonStr = this.extractJsonCandidate(response);
    
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    
    jsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    
    jsonStr = jsonStr.replace(/'/g, '"');
    
    jsonStr = this.fixUnescapedQuotes(jsonStr);
    
    jsonStr = this.fixTruncatedStrings(jsonStr);
    
    const parsed = JSON.parse(jsonStr);
    const validated = this.validateAndNormalize(parsed);
    
    return {
      success: true,
      data: validated,
      strategy: 'fix_common_errors'
    };
  }

  private static aggressiveCleaning(response: string): ParseResult {
    let jsonStr = this.extractJsonCandidate(response);
    
    jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, '');
    jsonStr = jsonStr.replace(/\s+/g, ' ');
    
    jsonStr = this.fixMalformedStructures(jsonStr);
    
    jsonStr = this.ensureProperClosing(jsonStr);
    
    const parsed = JSON.parse(jsonStr);
    const validated = this.validateAndNormalize(parsed);
    
    return {
      success: true,
      data: validated,
      strategy: 'aggressive_cleaning'
    };
  }

  private static structuralReconstruction(response: string): ParseResult {
    const matches: EnhancedResultMatch[] = [];
    
    const nameMatches = response.match(/"name":\s*"([^"]+)"/g) || [];
    const names = nameMatches.map(match => match.match(/"([^"]+)"$/)?.[1]).filter(Boolean);
    
    const priceMatches = response.match(/"price":\s*(\d+)/g) || [];
    const prices = priceMatches.map(match => parseInt(match.match(/(\d+)/)?.[1] || '0'));
    
    const mealMatches = response.match(/"meals":\s*(\d+)/g) || [];
    const meals = mealMatches.map(match => parseInt(match.match(/(\d+)/)?.[1] || '2'));
    
    const reasonMatches = response.match(/"reason":\s*"([^"]*)/g) || [];
    const reasons = reasonMatches.map(match => {
      const reason = match.match(/"([^"]*)/)?.[1] || '';
      return reason + (reason.endsWith('.') ? '' : '...');
    });
    
    const maxLength = Math.max(names.length, prices.length, meals.length);
    for (let i = 0; i < maxLength; i++) {
      matches.push({
        name: names[i] || `Restaurant ${i + 1}`,
        meals: meals[i] || 2,
        price: prices[i] || 500,
        image: "No image available",
        reason: reasons[i] || "Recommended based on your preferences"
      });
    }
    
    return {
      success: true,
      data: { matches },
      strategy: 'structural_reconstruction'
    };
  }

  private static extractJsonCandidate(response: string): string {
    const firstBrace = response.indexOf('{');
    const lastBrace = response.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
      return response.substring(firstBrace, lastBrace + 1);
    }
    
    return response.trim();
  }

  private static fixUnescapedQuotes(jsonStr: string): string {
    return jsonStr.replace(/"([^"]*)"([^"]*)"([^"]*?)"/g, (match, p1, p2, p3) => {
      if (p2.includes('"')) {
        const escaped = p2.replace(/"/g, '\\"');
        return `"${p1}${escaped}${p3}"`;
      }
      return match;
    });
  }

  private static fixTruncatedStrings(jsonStr: string): string {
    const lines = jsonStr.split('\n');
    const lastLine = lines[lines.length - 1];
    
    if (lastLine.includes('"') && !lastLine.match(/"[^"]*"$/)) {
      const openQuoteIndex = lastLine.lastIndexOf('"');
      if (openQuoteIndex !== -1) {
        lines[lines.length - 1] = lastLine.substring(0, openQuoteIndex + 1) + '"';
      }
    }
    
    return lines.join('\n');
  }

  private static fixMalformedStructures(jsonStr: string): string {
    const openBrackets = (jsonStr.match(/\[/g) || []).length;
    const closeBrackets = (jsonStr.match(/\]/g) || []).length;
    
    if (openBrackets > closeBrackets) {
      jsonStr += ']'.repeat(openBrackets - closeBrackets);
    }
    
    const openBraces = (jsonStr.match(/\{/g) || []).length;
    const closeBraces = (jsonStr.match(/\}/g) || []).length;
    
    if (openBraces > closeBraces) {
      jsonStr += '}'.repeat(openBraces - closeBraces);
    }
    
    return jsonStr;
  }

  private static ensureProperClosing(jsonStr: string): string {
    jsonStr = jsonStr.trim();
    
    const lastBraceIndex = jsonStr.lastIndexOf('}');
    if (lastBraceIndex !== -1) {
      jsonStr = jsonStr.substring(0, lastBraceIndex + 1);
    }
    
    return jsonStr;
  }

  private static validateAndNormalize(data: any): { matches: EnhancedResultMatch[] } {
    if (!data || typeof data !== 'object') {
      return { matches: [] };
    }
    
    let matches: any[] = [];
    
    if (data.matches && Array.isArray(data.matches)) {
      matches = data.matches;
    } else if (Array.isArray(data)) {
      matches = data;
    } else if (data.recommendations && Array.isArray(data.recommendations)) {
      matches = data.recommendations;
    }
    
    const normalizedMatches: EnhancedResultMatch[] = matches.map((match, index) => ({
      name: match.name || `Restaurant ${index + 1}`,
      meals: parseInt(match.meals) || parseInt(match.pax) || 2,
      price: parseInt(match.price) || parseInt(match.total) || 500,
      image: match.image || "No image available",
      reason: match.reason || match.description || "Recommended based on your preferences"
    }));
    
    return { matches: normalizedMatches };
  }
}
