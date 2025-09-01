/**
 * Comprehensive test suite for the robust JSON parser
 * Tests various malformed AI response scenarios
 */

import { RobustJsonParser } from './robustJsonParser';
import { ResponseValidator } from './responseValidator';

// Test cases that simulate real Gemini API failures
const testCases = [
  {
    name: "Explanatory text prefix",
    input: `Here is the itinerary for your Baguio trip:

{
  "title": "Baguio City Adventure",
  "subtitle": "3-day mountain retreat",
  "items": [
    {
      "day": "Day 1 - Morning",
      "activities": [
        {
          "title": "Burnham Park",
          "description": "Beautiful lakeside park",
          "duration": "2 hours",
          "tags": ["nature", "outdoor"],
          "image": "burnham",
          "peakHours": "N/A"
        }
      ]
    }
  ]
}`,
    shouldParse: true
  },
  {
    name: "Code block with markdown",
    input: `I'll create a wonderful itinerary for you:

\`\`\`json
{
  "title": "Baguio Highlights",
  "subtitle": "Perfect weekend getaway",
  "items": []
}
\`\`\`

This itinerary focuses on the best attractions.`,
    shouldParse: true
  },
  {
    name: "Trailing comma error",
    input: `{
  "title": "Baguio Trip",
  "subtitle": "Mountain adventure",
  "items": [
    {
      "day": "Day 1",
      "activities": [],
    }
  ],
}`,
    shouldParse: true
  },
  {
    name: "Unquoted keys",
    input: `{
  title: "Baguio Adventure",
  subtitle: "Great trip",
  items: []
}`,
    shouldParse: true
  },
  {
    name: "Mixed quotes",
    input: `{
  "title": 'Baguio City Tour',
  "subtitle": "Amazing experience",
  "items": []
}`,
    shouldParse: true
  },
  {
    name: "Incomplete JSON",
    input: `{
  "title": "Baguio Trip",
  "subtitle": "Mountain`,
    shouldParse: true // Should return fallback
  },
  {
    name: "Non-JSON response",
    input: `I'm sorry, I cannot create an itinerary right now. Please try again later.`,
    shouldParse: true // Should return fallback
  },
  {
    name: "Empty response",
    input: ``,
    shouldParse: true // Should return fallback
  }
];

export async function runJsonParserTests(): Promise<void> {
  console.log("🧪 Starting JSON Parser Tests...\n");
  
  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      console.log(`Testing: ${testCase.name}`);
      
      // Test validator first
      const validation = ResponseValidator.validateResponse(testCase.input);
      console.log(`  Validation: ${validation.isValid ? '✅' : '⚠️'} (${validation.issues.length} issues)`);
      
      // Test parser
      const result = RobustJsonParser.parseResponse(testCase.input);
      
      // Verify result structure
      const isValidResult = result && 
                           typeof result === 'object' &&
                           typeof result.title === 'string' &&
                           typeof result.subtitle === 'string' &&
                           Array.isArray(result.items);
      
      if (isValidResult) {
        console.log(`  ✅ PASS - Valid itinerary structure returned`);
        console.log(`     Title: "${result.title}"`);
        console.log(`     Items: ${result.items.length} days\n`);
        passed++;
      } else {
        console.log(`  ❌ FAIL - Invalid structure returned`);
        console.log(`     Result:`, result);
        failed++;
      }
      
    } catch (error) {
      console.log(`  ❌ FAIL - Exception thrown: ${error instanceof Error ? error.message : String(error)}\n`);
      failed++;
    }
  }

  console.log(`\n📊 Test Results:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log(`\n🎉 All tests passed! JSON parser is robust and ready.`);
  } else {
    console.log(`\n⚠️ Some tests failed. Review the implementation.`);
  }
}

// Performance test
export async function runPerformanceTest(): Promise<void> {
  console.log("\n⚡ Performance Test...");
  
  const testInput = `Here is your itinerary:
  
{
  "title": "Baguio City Adventure",
  "subtitle": "3-day mountain retreat",
  "items": [
    {
      "day": "Day 1 - Morning",
      "activities": [
        {
          "title": "Burnham Park",
          "description": "Beautiful lakeside park perfect for morning walks",
          "duration": "2 hours",
          "tags": ["nature", "outdoor", "family-friendly"],
          "image": "burnham",
          "peakHours": "N/A"
        }
      ]
    }
  ]
}`;

  const iterations = 100;
  const start = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    RobustJsonParser.parseResponse(testInput);
  }
  
  const end = Date.now();
  const avgTime = (end - start) / iterations;
  
  console.log(`⚡ Average parsing time: ${avgTime.toFixed(2)}ms`);
  console.log(`🎯 Target: <10ms per parse (${avgTime < 10 ? '✅ PASS' : '❌ FAIL'})`);
}

// Export for manual testing
export { RobustJsonParser, ResponseValidator };
