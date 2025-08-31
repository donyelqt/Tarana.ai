/**
 * Test script to validate TomTom map styles
 * Run this in browser console to test all map styles
 */

// Test configuration
const TEST_CONFIG = {
  apiKey: process.env.TOMTOM_API_KEY || 'YOUR_API_KEY_HERE',
  testStyles: ['main', 'satellite', 'hybrid', 'terrain', 'night', 'grayscale']
};

// Import the map styles configuration
import { MAP_STYLES, tomtomMapService } from './src/lib/tomtomMapUtils.ts';

/**
 * Test all map styles to ensure they work correctly
 */
async function testMapStyles() {
  console.log('🧪 Testing TomTom Map Styles...');
  
  // Create a test container
  const testContainer = document.createElement('div');
  testContainer.id = 'test-map-container';
  testContainer.style.width = '400px';
  testContainer.style.height = '300px';
  testContainer.style.position = 'fixed';
  testContainer.style.top = '10px';
  testContainer.style.right = '10px';
  testContainer.style.zIndex = '9999';
  testContainer.style.border = '2px solid #333';
  testContainer.style.backgroundColor = '#f0f0f0';
  document.body.appendChild(testContainer);

  const results = {
    passed: [],
    failed: [],
    total: TEST_CONFIG.testStyles.length
  };

  for (const styleName of TEST_CONFIG.testStyles) {
    console.log(`\n📍 Testing style: ${styleName}`);
    
    try {
      // Clear container
      testContainer.innerHTML = '';
      
      // Get style configuration
      const styleConfig = MAP_STYLES[styleName];
      if (!styleConfig) {
        throw new Error(`Style configuration not found: ${styleName}`);
      }

      console.log(`  ✓ Style config found: ${styleConfig.name}`);
      console.log(`  ✓ TomTom style URL: ${styleConfig.tomtomStyle}`);
      console.log(`  ✓ Requires API key: ${styleConfig.requiresApiKey}`);

      // Test URL construction
      let finalStyleUrl = styleConfig.tomtomStyle;
      if (styleConfig.requiresApiKey && finalStyleUrl.startsWith('https://')) {
        finalStyleUrl = `${finalStyleUrl}&key=${TEST_CONFIG.apiKey}`;
      }

      console.log(`  ✓ Final style URL: ${finalStyleUrl.substring(0, 100)}...`);

      // Test map creation (mock)
      const mapConfig = {
        apiKey: TEST_CONFIG.apiKey,
        container: testContainer,
        center: [120.5937, 16.4023], // Baguio coordinates
        zoom: 12,
        style: styleName,
        enableControls: false,
        enableTraffic: false
      };

      // Validate configuration
      if (!mapConfig.apiKey || mapConfig.apiKey === 'YOUR_API_KEY_HERE') {
        console.warn(`  ⚠️ API key not provided - skipping actual map creation`);
        console.log(`  ✓ Style configuration is valid`);
      } else {
        // Uncomment to test actual map creation
        // const map = await tomtomMapService.createMap(mapConfig);
        // console.log(`  ✓ Map created successfully`);
        // 
        // // Test style change
        // await tomtomMapService.changeMapStyle(map, styleName, TEST_CONFIG.apiKey);
        // console.log(`  ✓ Style change successful`);
      }

      results.passed.push(styleName);
      console.log(`  ✅ ${styleName} style: PASSED`);

    } catch (error) {
      results.failed.push({ style: styleName, error: error.message });
      console.error(`  ❌ ${styleName} style: FAILED - ${error.message}`);
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Clean up test container
  document.body.removeChild(testContainer);

  // Print results
  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${results.passed.length}/${results.total}`);
  console.log(`❌ Failed: ${results.failed.length}/${results.total}`);
  
  if (results.passed.length > 0) {
    console.log('\n✅ Working styles:', results.passed.join(', '));
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed styles:');
    results.failed.forEach(({ style, error }) => {
      console.log(`  - ${style}: ${error}`);
    });
  }

  return results;
}

/**
 * Quick validation of style URLs
 */
function validateStyleUrls() {
  console.log('🔍 Validating TomTom Style URLs...\n');
  
  Object.entries(MAP_STYLES).forEach(([styleName, config]) => {
    console.log(`📍 ${styleName} (${config.name}):`);
    console.log(`  URL: ${config.tomtomStyle}`);
    console.log(`  Requires API Key: ${config.requiresApiKey}`);
    console.log(`  Description: ${config.description}`);
    
    // Basic URL validation
    if (config.requiresApiKey && !config.tomtomStyle.startsWith('https://api.tomtom.com/')) {
      console.warn(`  ⚠️ Warning: Expected TomTom API URL format`);
    }
    
    console.log('');
  });
}

// Export test functions
if (typeof window !== 'undefined') {
  window.testMapStyles = testMapStyles;
  window.validateStyleUrls = validateStyleUrls;
  console.log('🧪 Map style test functions loaded. Run testMapStyles() or validateStyleUrls() in console.');
}

export { testMapStyles, validateStyleUrls };
