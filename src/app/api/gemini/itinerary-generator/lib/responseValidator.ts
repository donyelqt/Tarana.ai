
export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  cleanedText?: string;
}

export class ResponseValidator {
  
  static validateResponse(text: string): ValidationResult {
    const issues: string[] = [];
    
    if (!text || typeof text !== 'string') {
      return {
        isValid: false,
        issues: ['Response is empty or not a string']
      };
    }

    if (text.trim().startsWith('Here is') || text.trim().startsWith('Here are')) {
      issues.push('Response starts with explanatory text instead of JSON');
    }

    if (text.includes('```') && !text.includes('{')) {
      issues.push('Response contains code blocks but no JSON structure');
    }

    const hasOpenBrace = text.includes('{');
    const hasCloseBrace = text.includes('}');
    
    if (!hasOpenBrace || !hasCloseBrace) {
      issues.push('Response missing JSON structure (braces)');
    }

    const braceCount = (text.match(/\{/g) || []).length;
    const closeBraceCount = (text.match(/\}/g) || []).length;
    
    if (braceCount !== closeBraceCount) {
      issues.push('Mismatched braces in response');
    }

    let cleanedText = this.preCleanResponse(text);

    return {
      isValid: issues.length === 0,
      issues,
      cleanedText
    };
  }

  private static preCleanResponse(text: string): string {
    let cleaned = text;

    cleaned = cleaned.replace(/^(Here is|Here are|I'll create|Let me create|Below is).*?(?=\{)/i, '');
    
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace !== -1 && lastBrace < cleaned.length - 10) {
      const afterJson = cleaned.substring(lastBrace + 1).trim();
      if (afterJson.length > 0 && !afterJson.startsWith(',') && !afterJson.startsWith(']')) {
        cleaned = cleaned.substring(0, lastBrace + 1);
      }
    }

    return cleaned.trim();
  }

  static looksLikeJson(text: string): boolean {
    const trimmed = text.trim();
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
           (trimmed.includes('{') && trimmed.includes('}'));
  }

  static extractJsonCandidates(text: string): string[] {
    const candidates: string[] = [];
    
    const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/gi;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      candidates.push(match[1].trim());
    }

    const braceRegex = /\{[\s\S]*?\}/g;
    while ((match = braceRegex.exec(text)) !== null) {
      candidates.push(match[0]);
    }

    if (this.looksLikeJson(text)) {
      candidates.push(text);
    }

    return candidates;
  }
}
