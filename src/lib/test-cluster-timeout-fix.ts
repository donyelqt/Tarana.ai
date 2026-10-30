#!/usr/bin/env tsx


interface MockActivity {
  title: string;
  trafficAnalysis?: {
    realTimeTraffic: {
      trafficLevel: string;
      congestionScore: number;
      recommendationScore: number;
    };
  };
  combinedTrafficScore?: number;
  trafficRecommendation?: string;
  crowdLevel?: string;
  tags?: string[];
}

function createFallbackCluster(cluster: MockActivity[]): MockActivity[] {
  console.log(`⚠️ FALLBACK CLUSTER: Marking ${cluster.length} activities as HIGH traffic due to timeout`);
  return cluster.map(activity => ({
    ...activity,
    trafficAnalysis: {
      realTimeTraffic: {
        trafficLevel: 'HIGH', 
        congestionScore: 100,
        recommendationScore: 0
      }
    },
    combinedTrafficScore: 25,
    trafficRecommendation: 'AVOID_NOW',
    crowdLevel: 'HIGH'
  }));
}

function applyStrictTrafficFiltering(activities: MockActivity[]): MockActivity[] {
  console.log(`\n🚦 STRICT TRAFFIC FILTERING: Starting with ${activities.length} activities`);
  
  const filtered = activities.filter(activity => {
    const trafficLevel = activity.trafficAnalysis?.realTimeTraffic?.trafficLevel;
    const crowdLevel = activity.crowdLevel;
    const recommendation = activity.trafficRecommendation;
    
    if (trafficLevel && !['VERY_LOW', 'LOW', 'MODERATE'].includes(trafficLevel)) {
      console.log(`🚫 EXCLUDING HIGH TRAFFIC: "${activity.title}" - Traffic Level: ${trafficLevel} (FORBIDDEN)`);
      return false;
    }
    
    if (!trafficLevel || trafficLevel === 'UNKNOWN') {
      console.log(`🚫 EXCLUDING UNKNOWN TRAFFIC: "${activity.title}" - Traffic Level: ${trafficLevel || 'UNKNOWN'} (CONSERVATIVE EXCLUSION)`);
      return false;
    }
    
    if (crowdLevel === 'HIGH' || crowdLevel === 'VERY_HIGH') {
      console.log(`🚫 EXCLUDING HIGH CROWDS: "${activity.title}" - Crowd Level: ${crowdLevel}`);
      return false;
    }
    
    if (recommendation === 'AVOID_NOW') {
      console.log(`🚫 EXCLUDING AVOID_NOW: "${activity.title}" - Recommendation: ${recommendation}`);
      return false;
    }
    
    const tags = [...(activity.tags || [])];
    if (trafficLevel === 'VERY_LOW' || trafficLevel === 'LOW') {
      if (!tags.includes('low-traffic')) {
        tags.push('low-traffic');
      }
    } else if (trafficLevel === 'MODERATE') {
      if (!tags.includes('moderate-traffic')) {
        tags.push('moderate-traffic');
      }
    }
    
    activity.tags = tags;
    
    console.log(`✅ TRAFFIC APPROVED: "${activity.title}" - Traffic: ${trafficLevel}, Crowd: ${crowdLevel || 'UNKNOWN'}, Recommendation: ${recommendation || 'UNKNOWN'}`);
    return true;
  });
  
  console.log(`🚫 EXCLUDED ACTIVITIES: ${activities.length - filtered.length}`);
  activities.forEach(activity => {
    const trafficLevel = activity.trafficAnalysis?.realTimeTraffic?.trafficLevel;
    const isExcluded = !filtered.find(f => f.title === activity.title);
    if (isExcluded) {
      console.log(`   - ${activity.title}: ${trafficLevel || 'UNKNOWN'} traffic`);
    }
  });
  
  console.log(`🎯 STRICT FILTERING COMPLETE: ${filtered.length}/${activities.length} activities passed`);
  console.log(`===============================================\n`);
  
  return filtered;
}

async function testClusterTimeoutFix() {
  console.log('🧪 TESTING CLUSTER TIMEOUT FIX');
  console.log('===============================================');
  
  console.log('\n📋 TEST CASE 1: Normal Activities');
  const normalActivities: MockActivity[] = [
    {
      title: 'Burnham Park',
      trafficAnalysis: {
        realTimeTraffic: {
          trafficLevel: 'LOW',
          congestionScore: 20,
          recommendationScore: 80
        }
      },
      crowdLevel: 'LOW',
      trafficRecommendation: 'VISIT_NOW'
    },
    {
      title: 'Session Road',
      trafficAnalysis: {
        realTimeTraffic: {
          trafficLevel: 'MODERATE',
          congestionScore: 50,
          recommendationScore: 60
        }
      },
      crowdLevel: 'MODERATE',
      trafficRecommendation: 'VISIT_SOON'
    }
  ];
  
  const normalFiltered = applyStrictTrafficFiltering(normalActivities);
  console.log(`✅ Normal activities test: ${normalFiltered.length}/2 activities passed (EXPECTED: 2)`);
  
  console.log('\n📋 TEST CASE 2: Fallback Cluster (Timeout Scenario)');
  const timeoutActivities: MockActivity[] = [
    { title: 'Mines View Park' },
    { title: 'Baguio Cathedral' },
    { title: 'Camp John Hay' }
  ];
  
  const fallbackActivities = createFallbackCluster(timeoutActivities);
  
  const fallbackFiltered = applyStrictTrafficFiltering(fallbackActivities);
  console.log(`✅ Fallback activities test: ${fallbackFiltered.length}/3 activities passed (EXPECTED: 0 - all should be excluded)`);
  
  console.log('\n📋 TEST CASE 3: Mixed Scenario');
  const mixedActivities = [
    ...normalActivities,
    ...fallbackActivities
  ];
  
  const mixedFiltered = applyStrictTrafficFiltering(mixedActivities);
  console.log(`✅ Mixed activities test: ${mixedFiltered.length}/5 activities passed (EXPECTED: 2 - only normal activities)`);
  
  console.log('\n📋 TEST CASE 4: Edge Cases');
  const edgeCaseActivities: MockActivity[] = [
    {
      title: 'Unknown Traffic Activity',
    },
    {
      title: 'High Traffic Activity',
      trafficAnalysis: {
        realTimeTraffic: {
          trafficLevel: 'HIGH',
          congestionScore: 90,
          recommendationScore: 10
        }
      }
    },
    {
      title: 'Severe Traffic Activity',
      trafficAnalysis: {
        realTimeTraffic: {
          trafficLevel: 'SEVERE',
          congestionScore: 100,
          recommendationScore: 0
        }
      }
    }
  ];
  
  const edgeFiltered = applyStrictTrafficFiltering(edgeCaseActivities);
  console.log(`✅ Edge cases test: ${edgeFiltered.length}/3 activities passed (EXPECTED: 0 - all should be excluded)`);
  
  console.log('\n🎯 CLUSTER TIMEOUT FIX TEST SUMMARY');
  console.log('===============================================');
  console.log(`✅ Normal activities: ${normalFiltered.length === 2 ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Fallback exclusion: ${fallbackFiltered.length === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Mixed scenario: ${mixedFiltered.length === 2 ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Edge cases: ${edgeFiltered.length === 0 ? 'PASS' : 'FAIL'}`);
  
  const allTestsPassed = (
    normalFiltered.length === 2 &&
    fallbackFiltered.length === 0 &&
    mixedFiltered.length === 2 &&
    edgeFiltered.length === 0
  );
  
  console.log(`\n🏆 OVERALL RESULT: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (allTestsPassed) {
    console.log('🎉 Cluster timeout fix is working correctly!');
    console.log('   - Fallback activities are marked as HIGH traffic');
    console.log('   - HIGH traffic activities are properly excluded');
    console.log('   - UNKNOWN traffic activities are conservatively excluded');
    console.log('   - Only VERY_LOW, LOW, and MODERATE traffic activities pass through');
  } else {
    console.log('⚠️ Some tests failed - review the filtering logic');
  }
}

testClusterTimeoutFix().catch(console.error);
