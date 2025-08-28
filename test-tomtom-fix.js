/**
 * Test script to verify TomTom Incidents API fix
 */

const { tomtomTrafficService } = require('./src/lib/tomtomTraffic.ts');

async function testTomTomFix() {
  console.log('🧪 Testing TomTom API fix...\n');
  
  // Test coordinates in Baguio City
  const testCoordinates = [
    { lat: 16.4023, lon: 120.5960, name: 'Burnham Park' },
    { lat: 16.4155, lon: 120.5933, name: 'Session Road' },
    { lat: 16.4108, lon: 120.6066, name: 'Baguio Cathedral' }
  ];

  for (const coord of testCoordinates) {
    console.log(`\n📍 Testing ${coord.name} (${coord.lat}, ${coord.lon})`);
    console.log('=' .repeat(50));
    
    try {
      const trafficData = await tomtomTrafficService.getLocationTrafficData(coord.lat, coord.lon);
      
      console.log(`✅ Success for ${coord.name}:`);
      console.log(`   Traffic Level: ${trafficData.trafficLevel}`);
      console.log(`   Congestion Score: ${trafficData.congestionScore}%`);
      console.log(`   Recommendation Score: ${trafficData.recommendationScore}%`);
      console.log(`   Incidents Found: ${trafficData.incidents.length}`);
      console.log(`   Last Updated: ${trafficData.lastUpdated.toISOString()}`);
      
    } catch (error) {
      console.error(`❌ Failed for ${coord.name}:`, error.message);
    }
    
    // Wait 1 second between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🎯 TomTom API test completed!');
}

// Run the test
testTomTomFix().catch(console.error);
