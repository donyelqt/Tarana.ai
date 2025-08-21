// Test script to verify peak hours detection
const { getManilaTime, isCurrentlyPeakHours, parsePeakHours, convertTo24Hour } = require('./src/lib/peakHours.ts');

console.log('=== PEAK HOURS DETECTION TEST ===');
console.log('Current Manila Time:', getManilaTime().toLocaleString('en-US', { 
  timeZone: 'Asia/Manila',
  hour12: true,
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
}));

const testCases = [
  '10:00 am - 12:00 pm',
  '6 am - 8 am / 5 pm - 6 pm', 
  '9:00 pm - 10:00 pm',
  '12:00 pm - 3:00 pm',
  '6:00 am - 6:00 pm'
];

console.log('\n=== TESTING PEAK HOURS DETECTION ===');
testCases.forEach(peakHours => {
  const isPeak = isCurrentlyPeakHours(peakHours);
  const periods = parsePeakHours(peakHours);
  console.log(`Peak Hours: "${peakHours}"`);
  console.log(`  Parsed periods:`, periods);
  console.log(`  Currently in peak: ${isPeak ? 'YES' : 'NO'}`);
  console.log('');
});

console.log('=== SAMPLE ACTIVITIES FROM YOUR ITINERARY ===');
const sampleActivities = [
  { title: 'Botanical Garden', peakHours: '10:00 am - 12:00 pm' },
  { title: 'Mines View Park', peakHours: '6 am - 8 am / 5 pm - 6 pm' },
  { title: 'Baguio Night Market', peakHours: '9:00 pm - 10:00 pm' },
  { title: 'Ili-Likha Artists Village', peakHours: '12:00 pm - 3:00 pm' }
];

sampleActivities.forEach(activity => {
  const isPeak = isCurrentlyPeakHours(activity.peakHours);
  console.log(`${activity.title}: ${isPeak ? 'CURRENTLY PEAK (should be filtered out)' : 'LOW TRAFFIC (can be suggested)'}`);
});
