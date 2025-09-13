// Test script for traffic-aware itinerary generation with new traffic levels
const { tomtomTrafficService } = require('./src/lib/traffic/tomtomTraffic');

// Test the new traffic level classifications
async function testTrafficLevels() {
  console.log('Testing new traffic level classifications...');
  
  // Test VERY_LOW traffic (0-19 congestion score)
  const veryLowTraffic = {
    lat: 16.4023,
    lon: 120.5960,
    incidents: [],
    congestionScore: 15,
    recommendationScore: 85,
    lastUpdated: new Date()
  };
  
  // Test LOW traffic (20-49 congestion score)
  const lowTraffic = {
    lat: 16.4023,
    lon: 120.5960,
    incidents: [],
    congestionScore: 35,
    recommendationScore: 65,
    lastUpdated: new Date()
  };
  
  // Test MODERATE traffic (50-79 congestion score)
  const moderateTraffic = {
    lat: 16.4023,
    lon: 120.5960,
    incidents: [],
    congestionScore: 65,
    recommendationScore: 35,
    lastUpdated: new Date()
  };
  
  // Test HIGH traffic (80-99 congestion score)
  const highTraffic = {
    lat: 16.4023,
    lon: 120.5960,
    incidents: [],
    congestionScore: 90,
    recommendationScore: 10,
    lastUpdated: new Date()
  };
  
  // Test SEVERE traffic (100 congestion score)
  const severeTraffic = {
    lat: 16.4023,
    lon: 120.5960,
    incidents: [],
    congestionScore: 100,
    recommendationScore: 0,
    lastUpdated: new Date()
  };
  
  console.log('Testing VERY_LOW traffic classification...');
  const veryLowLevel = tomtomTrafficService.getTrafficLevel(15, []);
  console.log(`Expected: VERY_LOW, Got: ${veryLowLevel}`);
  
  console.log('Testing LOW traffic classification...');
  const lowLevel = tomtomTrafficService.getTrafficLevel(35, []);
  console.log(`Expected: LOW, Got: ${lowLevel}`);
  
  console.log('Testing MODERATE traffic classification...');
  const moderateLevel = tomtomTrafficService.getTrafficLevel(65, []);
  console.log(`Expected: MODERATE, Got: ${moderateLevel}`);
  
  console.log('Testing HIGH traffic classification...');
  const highLevel = tomtomTrafficService.getTrafficLevel(90, []);
  console.log(`Expected: HIGH, Got: ${highLevel}`);
  
  console.log('Testing SEVERE traffic classification...');
  const severeLevel = tomtomTrafficService.getTrafficLevel(100, []);
  console.log(`Expected: SEVERE, Got: ${severeLevel}`);
  
  console.log('All traffic level tests completed.');
}

testTrafficLevels();
