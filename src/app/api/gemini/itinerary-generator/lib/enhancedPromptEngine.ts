/**
 * Enhanced Prompt Engineering System
 * Implements industry-standard prompt engineering techniques for guaranteed JSON output
 * Uses chain-of-thought, few-shot learning, and strict format enforcement
 */

import { z } from 'zod';

/**
 * Advanced Prompt Engineering Engine
 * Implements multiple prompt engineering strategies for reliable JSON generation
 */
export class EnhancedPromptEngine {
  
  /**
   * Generate bulletproof prompt with multiple enforcement layers
   */
  static buildBulletproofPrompt(
    originalPrompt: string,
    sampleItinerary: any,
    weatherContext: string,
    trafficContext: string,
    additionalContext: string = ''
  ): string {
    
    const jsonSchema = this.getStrictJsonSchema();
    const fewShotExamples = this.getFewShotExamples();
    const chainOfThoughtInstructions = this.getChainOfThoughtInstructions();
    const strictFormatEnforcement = this.getStrictFormatEnforcement();
    const allowedActivityTitles = sampleItinerary
      ? Array.from(
          new Set(
            (Array.isArray(sampleItinerary.items) ? sampleItinerary.items : []).
              flatMap((item: any) =>
                Array.isArray(item?.activities)
                  ? item.activities
                      .map((activity: any) =>
                        typeof activity?.title === 'string' && activity.title.trim().length > 0
                          ? activity.title.trim()
                          : null
                      )
                      .filter((title: string | null): title is string => Boolean(title))
                  : []
              )
          )
        )
      : [];

    const allowedActivityGuidance = allowedActivityTitles.length
      ? `ALLOWED ACTIVITY TITLES (USE EXACTLY AS WRITTEN):\n${allowedActivityTitles
          .map((title) => `- ${title}`)
          .join('\n')}\n\nRULES:\n- You MUST select activities only from the titles above.\n- NEVER invent new establishments, activities, or locations.\n- If no suitable activity exists for a period, return an empty "activities" array for that period.\n\n`
      : '';

    return `${this.getSystemPrompt()}

${originalPrompt}

${sampleItinerary ? `EXCLUSIVE DATABASE: ${JSON.stringify(sampleItinerary)}` : ''}

${allowedActivityGuidance}${weatherContext}
${trafficContext}
${additionalContext}

${chainOfThoughtInstructions}

${fewShotExamples}

${strictFormatEnforcement}

${jsonSchema}

FINAL INSTRUCTION: Return ONLY the JSON object. No explanations, no markdown, no code blocks. Just pure JSON.`;
  }

  /**
   * System prompt with role definition and constraints
   */
  private static getSystemPrompt(): string {
    return `You are a professional travel itinerary generator AI. Your ONLY job is to return valid JSON objects that match the exact schema provided. You NEVER return explanatory text, markdown formatting, or anything other than pure JSON.

CRITICAL CONSTRAINTS:
- Output ONLY valid JSON that matches the provided schema
- Never include explanatory text before or after JSON
- Never use markdown code blocks or formatting
- Never include comments in JSON
- Always use double quotes for strings
- Always include trailing commas correctly
- Always close all brackets and braces properly`;
  }

  /**
   * Chain-of-thought instructions for systematic thinking
   */
  private static getChainOfThoughtInstructions(): string {
    return `SYSTEMATIC APPROACH - Follow these steps internally (do not output these steps):

Step 1: ANALYZE the user request and identify key requirements
Step 2: FILTER activities from database that match requirements  
Step 3: ORGANIZE activities by time periods (Morning/Afternoon/Evening)
Step 4: VALIDATE each activity has all required fields (image, title, time, desc, tags)
Step 5: CONSTRUCT the JSON object following the exact schema
Step 6: VERIFY the JSON is valid and complete before output

Remember: Think through these steps but OUTPUT ONLY THE FINAL JSON.`;
  }

  /**
   * Few-shot learning examples for pattern recognition
   */
  private static getFewShotExamples(): string {
    return `EXAMPLE OUTPUT FORMAT (follow this exact pattern):

{
  "title": "Baguio City Adventure",
  "subtitle": "2-day cultural and nature exploration",
  "items": [
    {
      "period": "Day 1 - Morning",
      "activities": [
        {
          "image": "/images/burnham_park.jpg",
          "title": "Burnham Park",
          "time": "8:00-10:00AM",
          "desc": "Start your day at this iconic park with LOW traffic conditions. Perfect time for peaceful walks and boat rides.",
          "tags": ["Nature", "Family-friendly", "Iconic"]
        }
      ]
    },
    {
      "period": "Day 1 - Afternoon", 
      "activities": [
        {
          "image": "/images/session_road.jpg",
          "title": "Session Road",
          "time": "2:00-4:00PM",
          "desc": "Explore the main commercial street during LOW traffic hours. Ideal for shopping and local cuisine.",
          "tags": ["Shopping", "Food", "Urban"]
        }
      ]
    }
  ]
}

CRITICAL: Your output must follow this EXACT structure and format.`;
  }

  /**
   * Strict format enforcement rules
   */
  private static getStrictFormatEnforcement(): string {
    return `STRICT FORMAT ENFORCEMENT:

JSON SYNTAX RULES (MANDATORY):
✓ Use double quotes for ALL strings
✓ No trailing commas after last array/object elements  
✓ Properly escape quotes in descriptions using \"
✓ Close all brackets [ ] and braces { } properly
✓ Use proper comma placement between elements
✓ No comments or explanatory text in JSON
✓ No undefined or null values - use empty strings/arrays instead

FIELD REQUIREMENTS (MANDATORY):
✓ title: Non-empty string (main itinerary title)
✓ subtitle: Non-empty string (descriptive subtitle)  
✓ items: Array with at least one period object
✓ period: String like "Day X - Morning/Afternoon/Evening"
✓ activities: Array of activity objects (can be empty)
✓ image: Valid image path from database
✓ title: Exact activity title from database
✓ time: Time slot like "9:00-10:30AM"
✓ desc: Description with traffic information
✓ tags: Array of strings from database

VALIDATION CHECKLIST:
□ JSON is syntactically valid
□ All required fields present
□ No extra fields added
□ Proper data types used
□ No malformed strings or arrays
□ Brackets and braces balanced
□ Commas placed correctly`;
  }

  /**
   * Strict JSON schema definition
   */
  private static getStrictJsonSchema(): string {
    return `MANDATORY JSON SCHEMA (your output MUST match exactly):

{
  "type": "object",
  "required": ["title", "subtitle", "items"],
  "properties": {
    "title": {
      "type": "string",
      "minLength": 1
    },
    "subtitle": {
      "type": "string", 
      "minLength": 1
    },
    "items": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["period", "activities"],
        "properties": {
          "period": {
            "type": "string",
            "pattern": "^Day \\d+ - (Morning|Afternoon|Evening)$"
          },
          "activities": {
            "type": "array",
            "items": {
              "type": "object", 
              "required": ["image", "title", "time", "desc", "tags"],
              "properties": {
                "image": {"type": "string", "minLength": 1},
                "title": {"type": "string", "minLength": 1},
                "time": {"type": "string", "minLength": 1},
                "desc": {"type": "string", "minLength": 10},
                "tags": {
                  "type": "array",
                  "items": {"type": "string"},
                  "minItems": 1
                }
              }
            }
          }
        }
      }
    }
  }
}

YOUR OUTPUT MUST CONFORM TO THIS SCHEMA EXACTLY.`;
  }

  /**
   * Generate validation prompt for double-checking
   */
  static buildValidationPrompt(jsonString: string): string {
    return `Validate this JSON for syntax errors and schema compliance:

${jsonString}

Check for:
1. Valid JSON syntax
2. Proper quote escaping
3. Balanced brackets/braces
4. Correct comma placement
5. All required fields present
6. Proper data types

Return ONLY "VALID" if correct, or the specific error if invalid.`;
  }

  /**
   * Clean and prepare prompt for optimal generation
   */
  static cleanPrompt(prompt: string): string {
    return prompt
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive newlines
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Generate prompt with progressive difficulty reduction
   */
  static buildProgressivePrompt(
    originalPrompt: string,
    attempt: number,
    maxAttempts: number
  ): string {
    const basePrompt = this.buildBulletproofPrompt(originalPrompt, null, '', '');
    
    if (attempt === 1) {
      return basePrompt;
    }
    
    // Simplify prompt for retries
    const simplificationLevel = Math.min(attempt - 1, 3);
    
    const simplifications = [
      '', // No simplification
      '\nSIMPLIFIED MODE: Focus on basic structure with minimal activities.',
      '\nMINIMAL MODE: Return simple itinerary with 1-2 activities maximum.',
      '\nFALLBACK MODE: Return basic structure even if activities are generic.'
    ];
    
    return basePrompt + simplifications[simplificationLevel];
  }
}

/**
 * JSON Syntax Validator
 * Validates JSON syntax before sending to parser
 */
export class JsonSyntaxValidator {
  
  /**
   * Pre-validate JSON string for common syntax errors
   */
  static validateSyntax(jsonString: string): {
    isValid: boolean;
    errors: string[];
    cleanedJson?: string;
  } {
    const errors: string[] = [];
    let cleaned = jsonString.trim();
    
    // Check for common issues
    if (!cleaned.startsWith('{')) {
      errors.push('JSON must start with opening brace {');
    }
    
    if (!cleaned.endsWith('}')) {
      errors.push('JSON must end with closing brace }');
    }
    
    // Check for unescaped quotes
    const unescapedQuotes = cleaned.match(/(?<!\\)"/g);
    if (unescapedQuotes && unescapedQuotes.length % 2 !== 0) {
      errors.push('Unmatched quotes detected');
    }
    
    // Check for trailing commas
    if (cleaned.includes(',}') || cleaned.includes(',]')) {
      errors.push('Trailing commas detected');
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
    }
    
    // Check bracket balance
    const openBraces = (cleaned.match(/{/g) || []).length;
    const closeBraces = (cleaned.match(/}/g) || []).length;
    const openBrackets = (cleaned.match(/\[/g) || []).length;
    const closeBrackets = (cleaned.match(/\]/g) || []).length;
    
    if (openBraces !== closeBraces) {
      errors.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
    }
    
    if (openBrackets !== closeBrackets) {
      errors.push(`Unbalanced brackets: ${openBrackets} open, ${closeBrackets} close`);
    }
    
    // Try to parse
    try {
      JSON.parse(cleaned);
      return {
        isValid: errors.length === 0,
        errors,
        cleanedJson: cleaned
      };
    } catch (parseError: any) {
      errors.push(`Parse error: ${parseError.message}`);
      return {
        isValid: false,
        errors
      };
    }
  }
  
  /**
   * Attempt to fix common JSON syntax errors
   */
  static attemptFix(jsonString: string): string {
    let fixed = jsonString.trim();
    
    // Remove markdown code blocks
    fixed = fixed.replace(/```json\s*|\s*```/g, '');
    
    // Remove explanatory text before/after JSON
    const jsonMatch = fixed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      fixed = jsonMatch[0];
    }
    
    // Fix trailing commas
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
    
    // Fix unescaped quotes in descriptions
    fixed = fixed.replace(/"desc":\s*"([^"]*)"([^"]*)"([^"]*)"/g, '"desc": "$1\\"$2\\"$3"');
    
    // Ensure proper string formatting
    fixed = fixed.replace(/:\s*([^",\[\]{}]+)(?=\s*[,}\]])/g, ': "$1"');
    
    return fixed;
  }
}
