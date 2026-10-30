
import { RobustFoodJsonParser } from './robustFoodJsonParser';
import { FoodRecommendationErrorHandler, FoodErrorType } from './foodRecommendationErrorHandler';

export class FoodRecommendationsTestSuite {
  
  static async runAllTests(): Promise<void> {
    console.log('🧪 Starting Food Recommendations Test Suite...\n');
    
    const tests = [
      this.testValidJson,
      this.testTruncatedJson,
      this.testMalformedJson,
      this.testJsonWithExplanation,
      this.testCodeBlockJson,
      this.testPartiallyCorruptedJson,
      this.testCompletelyInvalidResponse,
      this.testErrorHandling,
      this.testPerformance
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
      try {
        await test.call(this);
        console.log(`✅ ${test.name} - PASSED`);
        passed++;
      } catch (error) {
        console.error(`❌ ${test.name} - FAILED:`, error);
        failed++;
      }
    }
    
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
      console.log('🎉 All tests passed! Food recommendations system is robust.');
    } else {
      console.log('⚠️ Some tests failed. Please review the implementation.');
    }
  }
  
  static testValidJson(): void {
    const validResponse = `{
      "matches": [
        {
          "name": "K-Flavors Buffet",
          "meals": 6,
          "price": 2394,
          "image": "No image available",
          "reason": "Offers a Korean buffet, ideal for a group of 6"
        }
      ]
    }`;
    
    const result = RobustFoodJsonParser.parseResponse(validResponse);
    
    if (!result.success || !result.data || result.data.matches.length !== 1) {
      throw new Error('Failed to parse valid JSON');
    }
    
    if (result.data.matches[0].name !== 'K-Flavors Buffet') {
      throw new Error('Incorrect parsing of restaurant name');
    }
  }
  
  static testTruncatedJson(): void {
    const truncatedResponse = `{
  "matches": [
    {
      "name": "K-Flavors Buffet",
      "meals": 6,
      "price": 2394,
      "image": "No image available",
      "reason": "Offers a Korean buffet, ideal for a group of 6 w`;
    
    const result = RobustFoodJsonParser.parseResponse(truncatedResponse);
    
    if (!result.success || !result.data) {
      throw new Error('Failed to handle truncated JSON');
    }
    
    if (result.data.matches.length === 0) {
      throw new Error('No matches extracted from truncated JSON');
    }
  }
  
  static testMalformedJson(): void {
    const malformedResponse = `{
      'matches': [
        {
          name: "Restaurant Name",
          "meals": 2,
          "price": 500,
          "image": "path/to/image",
          "reason": "Good choice",
        }
      ]
    }`;
    
    const result = RobustFoodJsonParser.parseResponse(malformedResponse);
    
    if (!result.success || !result.data || result.data.matches.length !== 1) {
      throw new Error('Failed to fix malformed JSON');
    }
  }
  
  static testJsonWithExplanation(): void {
    const responseWithText = `Here is the restaurant recommendation for your request:

    {
      "matches": [
        {
          "name": "Oh My Gulay",
          "meals": 4,
          "price": 800,
          "image": "No image available",
          "reason": "Vegetarian restaurant within budget"
        }
      ]
    }
    
    I hope this helps with your dining decision!`;
    
    const result = RobustFoodJsonParser.parseResponse(responseWithText);
    
    if (!result.success || !result.data || result.data.matches.length !== 1) {
      throw new Error('Failed to extract JSON from explanatory text');
    }
    
    if (result.data.matches[0].name !== 'Oh My Gulay') {
      throw new Error('Incorrect restaurant name extraction');
    }
  }
  
  static testCodeBlockJson(): void {
    const codeBlockResponse = `Here are the recommendations:

\`\`\`json
{
  "matches": [
    {
      "name": "Myeong Dong Jjigae",
      "meals": 3,
      "price": 1500,
      "image": "No image available",
      "reason": "Korean restaurant"
    }
  ]
}
\`\`\``;
    
    const result = RobustFoodJsonParser.parseResponse(codeBlockResponse);
    
    if (!result.success || !result.data || result.data.matches.length !== 1) {
      throw new Error('Failed to extract JSON from code blocks');
    }
  }
  
  static testPartiallyCorruptedJson(): void {
    const corruptedResponse = `{
      "matches": [
        {
          "name": "Good Shepherd Cafe",
          "meals": 2,
          "price": 400,
          "image": "No image available",
          "reason": "Famous for ube jam and strawberry jam
        },
        {
          "name": "Uji-Matcha Cafe"`;
    
    const result = RobustFoodJsonParser.parseResponse(corruptedResponse);
    
    if (!result.success || !result.data) {
      throw new Error('Failed to handle partially corrupted JSON');
    }
    
    if (result.data.matches.length === 0) {
      throw new Error('No data extracted from corrupted JSON');
    }
  }
  
  static testCompletelyInvalidResponse(): void {
    const invalidResponse = `This is not JSON at all. Just random text with no structure.`;
    
    const result = RobustFoodJsonParser.parseResponse(invalidResponse);
    
    if (!result.success || !result.data) {
      throw new Error('Failed to handle completely invalid response');
    }
    
    if (!Array.isArray(result.data.matches)) {
      throw new Error('Should return empty matches array for invalid response');
    }
  }
  
  static testErrorHandling(): void {
    const testError = new Error('Test JSON parsing error');
    const foodError = FoodRecommendationErrorHandler.createError(testError, 'test_context');
    
    if (foodError.type !== FoodErrorType.GENERATION) {
      throw new Error('Incorrect error type classification');
    }
    
    if (!foodError.requestId || !foodError.timestamp) {
      throw new Error('Missing error metadata');
    }
    
    const errorResponse = FoodRecommendationErrorHandler.createErrorResponse(foodError);
    
    if (!errorResponse.error || !errorResponse.requestId) {
      throw new Error('Invalid error response structure');
    }
    
    const stats = FoodRecommendationErrorHandler.getStats();
    if (stats.totalErrors === 0) {
      throw new Error('Error statistics not updated');
    }
  }
  
  static testPerformance(): void {
    const largeResponse = `{
      "matches": [
        ${Array.from({ length: 100 }, (_, i) => `{
          "name": "Restaurant ${i}",
          "meals": ${Math.floor(Math.random() * 8) + 1},
          "price": ${Math.floor(Math.random() * 2000) + 200},
          "image": "No image available",
          "reason": "Test restaurant number ${i}"
        }`).join(',')}
      ]
    }`;
    
    const startTime = Date.now();
    const result = RobustFoodJsonParser.parseResponse(largeResponse);
    const endTime = Date.now();
    
    const parseTime = endTime - startTime;
    
    if (!result.success || !result.data) {
      throw new Error('Failed to parse large response');
    }
    
    if (parseTime > 100) { 
      throw new Error(`Performance issue: parsing took ${parseTime}ms`);
    }
    
    if (result.data.matches.length !== 100) {
      throw new Error('Incorrect number of matches parsed');
    }
  }
  
  static testActualProblematicResponse(): void {
    const actualResponse = `\`\`\`json
{
  "matches": [
    {
      "name": "K-Flavors Buffet",
      "meals": 6,
      "price": 2394,
      "image": "No image available",
      "reason": "Offers a Korean buffet, ideal for a group of 6 with a varied taste and within the budget (assuming average price per person of 399 pesos)."
    },
    {
      "name": "Myeong Dong Jjigae Restaurant",
      "meals": 6,
      "price": 3594,
      "image": "No image available",
      "reason": "Offers a Korean buffet, ideal for a group of 6 w`;
    
    const result = RobustFoodJsonParser.parseResponse(actualResponse);
    
    if (!result.success || !result.data) {
      throw new Error('Failed to handle actual problematic response');
    }
    
    if (result.data.matches.length === 0) {
      throw new Error('No matches extracted from actual response');
    }
    
    const firstMatch = result.data.matches[0];
    if (firstMatch.name !== 'K-Flavors Buffet') {
      throw new Error('Incorrect first restaurant name');
    }
  }
}

export async function runFoodRecommendationsTests(): Promise<void> {
  await FoodRecommendationsTestSuite.runAllTests();
}

if (typeof window === 'undefined' && require.main === module) {
  runFoodRecommendationsTests().catch(console.error);
}
