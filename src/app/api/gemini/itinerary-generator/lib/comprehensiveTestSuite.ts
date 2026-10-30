
import { GuaranteedJsonEngine } from './guaranteedJsonEngine';
import { StructuredOutputEngine } from './structuredOutputEngine';
import { EnhancedPromptEngine, JsonSyntaxValidator } from './enhancedPromptEngine';
import { ItinerarySchema } from './structuredOutputEngine';

export class ComprehensiveTestSuite {
  
  static async runAllTests(): Promise<{
    passed: number;
    failed: number;
    results: Array<{ test: string; status: 'PASS' | 'FAIL'; details: string; duration: number }>;
    overallStatus: 'PASS' | 'FAIL';
  }> {
    
    console.log('🧪 COMPREHENSIVE TEST SUITE: Starting all tests...');
    const startTime = Date.now();
    
    const tests = [
      { name: 'JSON Syntax Validator', fn: this.testJsonSyntaxValidator },
      { name: 'Enhanced Prompt Engine', fn: this.testEnhancedPromptEngine },
      { name: 'Structured Output Engine', fn: this.testStructuredOutputEngine },
      { name: 'Guaranteed JSON Engine', fn: this.testGuaranteedJsonEngine },
      { name: 'Edge Cases', fn: this.testEdgeCases },
      { name: 'Performance Stress Test', fn: this.testPerformanceStress },
      { name: 'Schema Validation', fn: this.testSchemaValidation },
      { name: 'Error Recovery', fn: this.testErrorRecovery }
    ];
    
    const results = [];
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
      const testStart = Date.now();
      try {
        console.log(`🔬 Running test: ${test.name}`);
        
        await test.fn();
        
        const duration = Date.now() - testStart;
        results.push({
          test: test.name,
          status: 'PASS' as const,
          details: `Completed successfully in ${duration}ms`,
          duration
        });
        passed++;
        console.log(`✅ ${test.name}: PASSED (${duration}ms)`);
        
      } catch (error: any) {
        const duration = Date.now() - testStart;
        results.push({
          test: test.name,
          status: 'FAIL' as const,
          details: error.message,
          duration
        });
        failed++;
        console.error(`❌ ${test.name}: FAILED - ${error.message}`);
      }
    }
    
    const totalDuration = Date.now() - startTime;
    const overallStatus = failed === 0 ? 'PASS' : 'FAIL';
    
    console.log(`🏁 COMPREHENSIVE TEST SUITE: Completed in ${totalDuration}ms`);
    console.log(`📊 Results: ${passed} passed, ${failed} failed`);
    
    return {
      passed,
      failed,
      results,
      overallStatus
    };
  }

  private static async testJsonSyntaxValidator(): Promise<void> {
    const validJson = '{"title": "Test", "items": []}';
    const validResult = JsonSyntaxValidator.validateSyntax(validJson);
    if (!validResult.isValid) {
      throw new Error('Valid JSON marked as invalid');
    }

    const invalidJson = '{"title": "Test", "items": [],}';
    const invalidResult = JsonSyntaxValidator.validateSyntax(invalidJson);
    if (invalidResult.isValid) {
      throw new Error('Invalid JSON marked as valid');
    }

    const fixed = JsonSyntaxValidator.attemptFix(invalidJson);
    const fixedResult = JsonSyntaxValidator.validateSyntax(fixed);
    if (!fixedResult.isValid) {
      throw new Error('JSON fixing failed');
    }

    const markdownJson = '```json\n{"title": "Test"}\n```';
    const cleanedMarkdown = JsonSyntaxValidator.attemptFix(markdownJson);
    if (cleanedMarkdown.includes('```')) {
      throw new Error('Markdown removal failed');
    }
  }

  private static async testEnhancedPromptEngine(): Promise<void> {
    const testPrompt = "Generate a Baguio itinerary";
    const sampleData = { items: [{ activities: [] }] };
    
    const bulletproofPrompt = EnhancedPromptEngine.buildBulletproofPrompt(
      testPrompt, sampleData, "Clear weather", "Low traffic"
    );
    
    if (!bulletproofPrompt.includes('JSON')) {
      throw new Error('Bulletproof prompt missing JSON instructions');
    }
    
    if (!bulletproofPrompt.includes('MANDATORY')) {
      throw new Error('Bulletproof prompt missing mandatory instructions');
    }

    const progressivePrompt = EnhancedPromptEngine.buildProgressivePrompt(
      testPrompt, 3, 5
    );
    
    if (!progressivePrompt.includes('SIMPLIFIED')) {
      throw new Error('Progressive prompt not simplifying correctly');
    }

    const messyPrompt = "Test   \n\n\n  prompt   ";
    const cleaned = EnhancedPromptEngine.cleanPrompt(messyPrompt);
    if (cleaned !== "Test prompt") {
      throw new Error('Prompt cleaning failed');
    }
  }

  private static async testStructuredOutputEngine(): Promise<void> {
    const health = await StructuredOutputEngine.healthCheck();
    if (!health.status) {
      throw new Error('Structured output engine health check failed');
    }

    const validItinerary = {
      title: "Test Itinerary",
      subtitle: "Test subtitle",
      items: [{
        period: "Day 1 - Morning",
        activities: [{
          image: "/test.jpg",
          title: "Test Activity",
          time: "9:00-10:00AM",
          desc: "Test description with enough characters",
          tags: ["test"]
        }]
      }]
    };

    const validation = ItinerarySchema.safeParse(validItinerary);
    if (!validation.success) {
      throw new Error(`Schema validation failed: ${validation.error.message}`);
    }
  }

  private static async testGuaranteedJsonEngine(): Promise<void> {
    GuaranteedJsonEngine.resetMetrics();

    const result = await GuaranteedJsonEngine.generateGuaranteedJson(
      "Generate a simple Baguio itinerary",
      null,
      "Clear weather",
      "Low traffic",
      "",
      "test-guaranteed"
    );

    const validation = ItinerarySchema.safeParse(result);
    if (!validation.success) {
      throw new Error(`Guaranteed engine produced invalid structure: ${validation.error.message}`);
    }

    const metrics = GuaranteedJsonEngine.getMetrics();
    if (metrics.totalRequests === 0) {
      throw new Error('Metrics not being tracked');
    }

    const health = await GuaranteedJsonEngine.healthCheck();
    if (health.status === 'unhealthy') {
      throw new Error('Guaranteed engine health check failed');
    }
  }

  private static async testEdgeCases(): Promise<void> {
    const emptyResult = await GuaranteedJsonEngine.generateGuaranteedJson(
      "",
      null,
      "",
      "",
      "",
      "test-empty"
    );
    
    const emptyValidation = ItinerarySchema.safeParse(emptyResult);
    if (!emptyValidation.success) {
      throw new Error('Empty prompt handling failed');
    }

    const longPrompt = "Generate itinerary ".repeat(100);
    const longResult = await GuaranteedJsonEngine.generateGuaranteedJson(
      longPrompt,
      null,
      "",
      "",
      "",
      "test-long"
    );
    
    const longValidation = ItinerarySchema.safeParse(longResult);
    if (!longValidation.success) {
      throw new Error('Long prompt handling failed');
    }

    const specialPrompt = "Generate itinerary with ₱ symbols and émojis 🎉";
    const specialResult = await GuaranteedJsonEngine.generateGuaranteedJson(
      specialPrompt,
      null,
      "",
      "",
      "",
      "test-special"
    );
    
    const specialValidation = ItinerarySchema.safeParse(specialResult);
    if (!specialValidation.success) {
      throw new Error('Special characters handling failed');
    }
  }

  private static async testPerformanceStress(): Promise<void> {
    const concurrentTests = 3;
    const startTime = Date.now();
    
    const promises = Array.from({ length: concurrentTests }, (_, i) =>
      GuaranteedJsonEngine.generateGuaranteedJson(
        `Test concurrent request ${i}`,
        null,
        "",
        "",
        "",
        `stress-test-${i}`
      )
    );

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    for (let i = 0; i < results.length; i++) {
      const validation = ItinerarySchema.safeParse(results[i]);
      if (!validation.success) {
        throw new Error(`Concurrent test ${i} failed validation`);
      }
    }

    if (duration > 30000) { 
      throw new Error(`Performance test too slow: ${duration}ms`);
    }

    console.log(`🚀 Performance test: ${concurrentTests} concurrent requests in ${duration}ms`);
  }

  private static async testSchemaValidation(): Promise<void> {
    const invalidStructures = [
      { title: "Test" }, 
      { title: "Test", subtitle: "Test" }, 
      { title: "Test", subtitle: "Test", items: [] }, 
      { 
        title: "Test", 
        subtitle: "Test", 
        items: [{ period: "Day 1 - Morning" }] 
      },
      {
        title: "Test",
        subtitle: "Test", 
        items: [{
          period: "Day 1 - Morning",
          activities: [{
            title: "Test", 
          }]
        }]
      }
    ];

    for (let i = 0; i < invalidStructures.length; i++) {
      const validation = ItinerarySchema.safeParse(invalidStructures[i]);
      if (validation.success) {
        throw new Error(`Invalid structure ${i} passed validation`);
      }
    }

    const validMinimal = {
      title: "Test",
      subtitle: "Test",
      items: [{
        period: "Day 1 - Morning",
        activities: []
      }]
    };

    const minimalValidation = ItinerarySchema.safeParse(validMinimal);
    if (!minimalValidation.success) {
      throw new Error('Valid minimal structure failed validation');
    }
  }

  private static async testErrorRecovery(): Promise<void> {
    const malformedSample = {
      items: "not an array",
      invalid: true
    };

    const recoveryResult = await GuaranteedJsonEngine.generateGuaranteedJson(
      "Test error recovery",
      malformedSample,
      "",
      "",
      "",
      "test-recovery"
    );

    const recoveryValidation = ItinerarySchema.safeParse(recoveryResult);
    if (!recoveryValidation.success) {
      throw new Error('Error recovery failed to produce valid output');
    }

    console.log('✅ Error recovery mechanisms working correctly');
  }

  static generateTestReport(results: any): string {
    const { passed, failed, results: testResults, overallStatus } = results;
    
    let report = `# JSON Reliability Test Report\n\n`;
    report += `**Overall Status:** ${overallStatus}\n`;
    report += `**Tests Passed:** ${passed}\n`;
    report += `**Tests Failed:** ${failed}\n`;
    report += `**Success Rate:** ${((passed / (passed + failed)) * 100).toFixed(1)}%\n\n`;
    
    report += `## Test Results\n\n`;
    
    for (const result of testResults) {
      const icon = result.status === 'PASS' ? '✅' : '❌';
      report += `${icon} **${result.test}** (${result.duration}ms)\n`;
      if (result.status === 'FAIL') {
        report += `   Error: ${result.details}\n`;
      }
      report += `\n`;
    }
    
    return report;
  }
}

export class AutomatedTestRunner {
  
  static async runAndExit(): Promise<void> {
    try {
      const results = await ComprehensiveTestSuite.runAllTests();
      const report = ComprehensiveTestSuite.generateTestReport(results);
      
      console.log('\n' + report);
      
      if (results.overallStatus === 'PASS') {
        console.log('🎉 All tests passed! JSON reliability guaranteed.');
        process.exit(0);
      } else {
        console.error('💥 Some tests failed! JSON reliability not guaranteed.');
        process.exit(1);
      }
    } catch (error) {
      console.error('🔥 Test runner crashed:', error);
      process.exit(1);
    }
  }

  static async smokeTest(): Promise<boolean> {
    try {
      console.log('💨 Running smoke test...');
      
      const result = await GuaranteedJsonEngine.generateGuaranteedJson(
        "Quick test",
        null,
        "",
        "",
        "",
        "smoke-test"
      );
      
      const validation = ItinerarySchema.safeParse(result);
      const isValid = validation.success;
      
      console.log(`💨 Smoke test: ${isValid ? 'PASSED' : 'FAILED'}`);
      return isValid;
      
    } catch (error) {
      console.error('💨 Smoke test failed:', error);
      return false;
    }
  }
}
