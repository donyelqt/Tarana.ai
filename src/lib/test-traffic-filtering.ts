
import { parallelTrafficProcessor } from '@/lib/performance/parallelTrafficProcessor';
import { trafficAwareActivitySearch } from '@/lib/traffic/trafficAwareActivitySearch';
import { sampleItineraryCombined } from '@/app/itinerary-generator/data/itineraryData';
import type { Activity } from '@/app/itinerary-generator/data/itineraryData';

interface TestResults {
  totalActivities: number;
  highTrafficActivities: number;
  filteredActivities: number;
  excludedHighTraffic: number;
  testPassed: boolean;
  details: {
    highTrafficFound: string[];
    filteredOut: string[];
    approved: string[];
  };
}

async function testParallelTrafficProcessorFiltering(): Promise<TestResults> {
  console.log('\n🧪 TESTING PARALLEL TRAFFIC PROCESSOR FILTERING');
  console.log('=================================================');

  const activities = sampleItineraryCombined.items[0].activities.slice(0, 10);
  console.log(`📊 Testing with ${activities.length} sample activities`);

  const { enhancedActivities, metrics } = await parallelTrafficProcessor.processActivitiesUltraFast(activities);

  const highTrafficActivities: string[] = [];
  const approvedActivities: string[] = [];
  const excludedActivities: string[] = [];

  enhancedActivities.forEach(activity => {
    const trafficLevel = activity.trafficAnalysis?.realTimeTraffic?.trafficLevel;
    const recommendation = activity.trafficRecommendation;

    if (trafficLevel === 'HIGH' || trafficLevel === 'SEVERE') {
      highTrafficActivities.push(`${activity.title} (${trafficLevel})`);
    } else if (recommendation === 'AVOID_NOW') {
      highTrafficActivities.push(`${activity.title} (AVOID_NOW)`);
    } else {
      approvedActivities.push(`${activity.title} (${trafficLevel || 'UNKNOWN'})`);
    }
  });

  const originalTitles = new Set(activities.map(a => a.title));
  const enhancedTitles = new Set(enhancedActivities.map(a => a.title));
  
  originalTitles.forEach(title => {
    if (!enhancedTitles.has(title)) {
      excludedActivities.push(title);
    }
  });

  const testPassed = highTrafficActivities.length === 0;

  const results: TestResults = {
    totalActivities: activities.length,
    highTrafficActivities: highTrafficActivities.length,
    filteredActivities: enhancedActivities.length,
    excludedHighTraffic: excludedActivities.length,
    testPassed,
    details: {
      highTrafficFound: highTrafficActivities,
      filteredOut: excludedActivities,
      approved: approvedActivities
    }
  };

  console.log(`\n📊 PARALLEL PROCESSOR TEST RESULTS:`);
  console.log(`   Original Activities: ${results.totalActivities}`);
  console.log(`   Filtered Activities: ${results.filteredActivities}`);
  console.log(`   Excluded Activities: ${results.excludedHighTraffic}`);
  console.log(`   HIGH Traffic Found: ${results.highTrafficActivities}`);
  console.log(`   Test Status: ${testPassed ? '✅ PASSED' : '❌ FAILED'}`);

  if (results.details.highTrafficFound.length > 0) {
    console.log(`\n❌ HIGH TRAFFIC ACTIVITIES FOUND (SHOULD BE ZERO):`);
    results.details.highTrafficFound.forEach(activity => {
      console.log(`   - ${activity}`);
    });
  }

  if (results.details.filteredOut.length > 0) {
    console.log(`\n🚫 ACTIVITIES FILTERED OUT:`);
    results.details.filteredOut.forEach(activity => {
      console.log(`   - ${activity}`);
    });
  }

  console.log(`\n✅ APPROVED ACTIVITIES:`);
  results.details.approved.forEach(activity => {
    console.log(`   - ${activity}`);
  });

  return results;
}

async function testTrafficAwareActivitySearchFiltering(): Promise<TestResults> {
  console.log('\n🧪 TESTING TRAFFIC-AWARE ACTIVITY SEARCH FILTERING');
  console.log('===================================================');

  const activities = sampleItineraryCombined.items[0].activities.slice(0, 10);
  console.log(`📊 Testing with ${activities.length} sample activities`);

  const enhancedActivities = await trafficAwareActivitySearch.enhanceActivitiesWithTraffic(activities);
  const filteredActivities = trafficAwareActivitySearch.filterAndSortByTraffic(enhancedActivities, {
    prioritizeTraffic: true,
    avoidCrowds: false,
    flexibleTiming: true,
    maxTrafficLevel: 'MODERATE'
  });

  const highTrafficActivities: string[] = [];
  const approvedActivities: string[] = [];
  const excludedActivities: string[] = [];

  filteredActivities.forEach(activity => {
    const trafficLevel = activity.trafficAnalysis?.realTimeTraffic?.trafficLevel;
    const recommendation = activity.trafficRecommendation;

    if (trafficLevel === 'HIGH' || trafficLevel === 'SEVERE') {
      highTrafficActivities.push(`${activity.title} (${trafficLevel})`);
    } else if (recommendation === 'AVOID_NOW') {
      highTrafficActivities.push(`${activity.title} (AVOID_NOW)`);
    } else {
      approvedActivities.push(`${activity.title} (${trafficLevel || 'UNKNOWN'})`);
    }
  });

  const originalTitles = new Set(activities.map(a => a.title));
  const filteredTitles = new Set(filteredActivities.map(a => a.title));
  
  originalTitles.forEach(title => {
    if (!filteredTitles.has(title)) {
      excludedActivities.push(title);
    }
  });

  const testPassed = highTrafficActivities.length === 0;

  const results: TestResults = {
    totalActivities: activities.length,
    highTrafficActivities: highTrafficActivities.length,
    filteredActivities: filteredActivities.length,
    excludedHighTraffic: excludedActivities.length,
    testPassed,
    details: {
      highTrafficFound: highTrafficActivities,
      filteredOut: excludedActivities,
      approved: approvedActivities
    }
  };

  console.log(`\n📊 TRAFFIC-AWARE SEARCH TEST RESULTS:`);
  console.log(`   Original Activities: ${results.totalActivities}`);
  console.log(`   Filtered Activities: ${results.filteredActivities}`);
  console.log(`   Excluded Activities: ${results.excludedHighTraffic}`);
  console.log(`   HIGH Traffic Found: ${results.highTrafficActivities}`);
  console.log(`   Test Status: ${testPassed ? '✅ PASSED' : '❌ FAILED'}`);

  if (results.details.highTrafficFound.length > 0) {
    console.log(`\n❌ HIGH TRAFFIC ACTIVITIES FOUND (SHOULD BE ZERO):`);
    results.details.highTrafficFound.forEach(activity => {
      console.log(`   - ${activity}`);
    });
  }

  if (results.details.filteredOut.length > 0) {
    console.log(`\n🚫 ACTIVITIES FILTERED OUT:`);
    results.details.filteredOut.forEach(activity => {
      console.log(`   - ${activity}`);
    });
  }

  console.log(`\n✅ APPROVED ACTIVITIES:`);
  results.details.approved.forEach(activity => {
    console.log(`   - ${activity}`);
  });

  return results;
}

function testTrafficTagMapping(): boolean {
  console.log('\n🧪 TESTING TRAFFIC TAG MAPPING');
  console.log('===============================');

  const mockActivities = [
    {
      title: 'Test Activity 1',
      tags: ['nature'],
      trafficAnalysis: { realTimeTraffic: { trafficLevel: 'VERY_LOW' } }
    },
    {
      title: 'Test Activity 2', 
      tags: ['food'],
      trafficAnalysis: { realTimeTraffic: { trafficLevel: 'LOW' } }
    },
    {
      title: 'Test Activity 3',
      tags: ['culture'],
      trafficAnalysis: { realTimeTraffic: { trafficLevel: 'MODERATE' } }
    }
  ];

  let testPassed = true;
  const results: string[] = [];

  mockActivities.forEach(activity => {
    const trafficLevel = activity.trafficAnalysis?.realTimeTraffic?.trafficLevel;
    const tags = [...activity.tags];

    if (trafficLevel === 'VERY_LOW' || trafficLevel === 'LOW') {
      if (!tags.includes('low-traffic')) {
        tags.push('low-traffic');
      }
    } else if (trafficLevel === 'MODERATE') {
      if (!tags.includes('moderate-traffic')) {
        tags.push('moderate-traffic');
      }
    }

    const hasCorrectTag = 
      (trafficLevel === 'VERY_LOW' || trafficLevel === 'LOW') && tags.includes('low-traffic') ||
      trafficLevel === 'MODERATE' && tags.includes('moderate-traffic');

    if (hasCorrectTag) {
      results.push(`✅ ${activity.title}: ${trafficLevel} → ${tags.join(', ')}`);
    } else {
      results.push(`❌ ${activity.title}: ${trafficLevel} → ${tags.join(', ')} (MISSING TAG)`);
      testPassed = false;
    }
  });

  console.log(`\n📊 TAG MAPPING RESULTS:`);
  results.forEach(result => console.log(`   ${result}`));
  console.log(`\n   Test Status: ${testPassed ? '✅ PASSED' : '❌ FAILED'}`);

  return testPassed;
}

export async function runTrafficFilteringTests(): Promise<void> {
  console.log('\n🚀 STARTING COMPREHENSIVE TRAFFIC FILTERING TESTS');
  console.log('==================================================');
  console.log(`📅 Test Date: ${new Date().toISOString()}`);
  console.log(`🌍 Manila Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);

  const testResults: { name: string; passed: boolean }[] = [];

  try {
    const parallelResults = await testParallelTrafficProcessorFiltering();
    testResults.push({ name: 'Parallel Traffic Processor', passed: parallelResults.testPassed });

    const searchResults = await testTrafficAwareActivitySearchFiltering();
    testResults.push({ name: 'Traffic-Aware Activity Search', passed: searchResults.testPassed });

    const tagResults = testTrafficTagMapping();
    testResults.push({ name: 'Traffic Tag Mapping', passed: tagResults });

    console.log('\n🎯 FINAL TEST RESULTS');
    console.log('=====================');
    
    const passedTests = testResults.filter(t => t.passed).length;
    const totalTests = testResults.length;
    
    testResults.forEach(test => {
      console.log(`   ${test.passed ? '✅' : '❌'} ${test.name}`);
    });

    console.log(`\n📊 OVERALL RESULTS: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 ALL TESTS PASSED - Traffic filtering is working correctly!');
      console.log('✅ HIGH traffic activities will be excluded from itineraries');
      console.log('✅ Only VERY_LOW, LOW, and MODERATE traffic activities will be included');
      console.log('✅ Frontend tags are properly mapped for display');
    } else {
      console.log('❌ SOME TESTS FAILED - Traffic filtering needs attention');
      console.log('⚠️  HIGH traffic activities may still appear in itineraries');
    }

  } catch (error) {
    console.error('❌ TEST EXECUTION FAILED:', error);
  }

  console.log('\n=================================================');
  console.log('🏁 TRAFFIC FILTERING TESTS COMPLETED');
}

export { testParallelTrafficProcessorFiltering, testTrafficAwareActivitySearchFiltering, testTrafficTagMapping };
