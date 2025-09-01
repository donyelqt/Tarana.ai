/**
 * Response validator for Gemini API responses
 * Pre-validates responses before JSON parsing to catch issues early
 */

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  cleanedText?: string;
}

export class ResponseValidator {
  
  /**
   * Validate and pre-process Gemini response before JSON parsing
   */
  static validateResponse(text: string): ValidationResult {
    const issues: string[] = [];
    
    if (!text || typeof text !== 'string') {
      return {
        isValid: false,
        issues: ['Response is empty or not a string']
      };
    }

    // Check for common problematic patterns
    if (text.trim().startsWith('Here is') || text.trim().startsWith('Here are')) {
      issues.push('Response starts with explanatory text instead of JSON');
    }

    if (text.includes('```') && !text.includes('{')) {
      issues.push('Response contains code blocks but no JSON structure');
    }

    // Look for JSON structure
    const hasOpenBrace = text.includes('{');
    const hasCloseBrace = text.includes('}');
    
    if (!hasOpenBrace || !hasCloseBrace) {
      issues.push('Response missing JSON structure (braces)');
    }

    // Check for multiple JSON objects
    const braceCount = (text.match(/\{/g) || []).length;
    const closeBraceCount = (text.match(/\}/g) || []).length;
    
    if (braceCount !== closeBraceCount) {
      issues.push('Mismatched braces in response');
    }

    // Pre-clean the text
    let cleanedText = this.preCleanResponse(text);

    return {
      isValid: issues.length === 0,
      issues,
      cleanedText
    };
  }

  /**
   * Pre-clean response to improve parsing success rate
   */
  private static preCleanResponse(text: string): string {
    let cleaned = text;

    // Remove common prefixes
    cleaned = cleaned.replace(/^(Here is|Here are|I'll create|Let me create|Below is).*?(?=\{)/i, '');
    
    // Remove trailing explanations after JSON
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace !== -1 && lastBrace < cleaned.length - 10) {
      const afterJson = cleaned.substring(lastBrace + 1).trim();
      if (afterJson.length > 0 && !afterJson.startsWith(',') && !afterJson.startsWith(']')) {
        cleaned = cleaned.substring(0, lastBrace + 1);
      }
    }

    return cleaned.trim();
  }

  /**
   * Check if response looks like it contains valid JSON structure
   */
  static looksLikeJson(text: string): boolean {
    const trimmed = text.trim();
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
           (trimmed.includes('{') && trimmed.includes('}'));
  }

  /**
   * Extract potential JSON from mixed content
   */
  static extractJsonCandidates(text: string): string[] {
    const candidates: string[] = [];
    
    // Try to find JSON in code blocks
    const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/gi;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      candidates.push(match[1].trim());
    }

    // Try to find JSON by brace matching
    const braceRegex = /\{[\s\S]*?\}/g;
    while ((match = braceRegex.exec(text)) !== null) {
      candidates.push(match[0]);
    }

    // Try the whole text if it looks like JSON
    if (this.looksLikeJson(text)) {
      candidates.push(text);
    }

    return candidates;
  }
}
