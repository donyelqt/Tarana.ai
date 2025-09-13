// Test script for traffic-aware itinerary generation with new traffic levels
const fs = require('fs');

// Test the new traffic level classifications by checking the updated files
console.log('Testing traffic-aware itinerary generation with new traffic levels...');

// Check if the Activity interface in itineraryData.ts has been updated
const itineraryDataPath = './src/app/itinerary-generator/data/itineraryData.ts';
if (fs.existsSync(itineraryDataPath)) {
  const itineraryDataContent = fs.readFileSync(itineraryDataPath, 'utf8');
  console.log('Activity interface updated with traffic properties:', 
    itineraryDataContent.includes('trafficAnalysis') && 
    itineraryDataContent.includes('combinedTrafficScore') && 
    itineraryDataContent.includes('trafficRecommendation') && 
    itineraryDataContent.includes('crowdLevel'));
} else {
  console.log('itineraryData.ts not found');
}

// Check if the LocationTrafficData interface in tomtomTraffic.ts has been updated
const tomtomTrafficPath = './src/lib/traffic/tomtomTraffic.ts';
if (fs.existsSync(tomtomTrafficPath)) {
  const tomtomTrafficContent = fs.readFileSync(tomtomTrafficPath, 'utf8');
  console.log('LocationTrafficData interface updated with VERY_LOW traffic level:', 
    tomtomTrafficContent.includes("'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE'"));
} else {
  console.log('tomtomTraffic.ts not found');
}

// Check if the traffic filtering logic in trafficAwareActivitySearch.ts has been updated
const trafficAwareSearchPath = './src/lib/traffic/trafficAwareActivitySearch.ts';
if (fs.existsSync(trafficAwareSearchPath)) {
  const trafficAwareSearchContent = fs.readFileSync(trafficAwareSearchPath, 'utf8');
  console.log('Traffic filtering logic updated to allow VERY_LOW, LOW, and MODERATE traffic:', 
    trafficAwareSearchContent.includes("['VERY_LOW', 'LOW', 'MODERATE'].includes(trafficLevel)"));
} else {
  console.log('trafficAwareActivitySearch.ts not found');
}

// Check if the context builder has been updated
const contextBuilderPath = './src/app/api/gemini/itinerary-generator/lib/contextBuilder.ts';
if (fs.existsSync(contextBuilderPath)) {
  const contextBuilderContent = fs.readFileSync(contextBuilderPath, 'utf8');
  console.log('Context builder updated with VERY_LOW traffic level:', 
    contextBuilderContent.includes('VERY_LOW: activitiesWithTraffic.filter'));
} else {
  console.log('contextBuilder.ts not found');
}

console.log('Traffic-aware itinerary generation test completed.');
