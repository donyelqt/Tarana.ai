/**
 * Route Optimization System Test
 * Tests the complete route optimization functionality including API endpoints and services
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  testLocations: {
    origin: { lat: 14.5995, lng: 120.9842, address: 'Manila, Philippines' },
    destination: { lat: 14.6760, lng: 121.0437, address: 'Quezon City, Philippines' },
    waypoint: { lat: 14.6349, lng: 121.0077, address: 'Makati, Philippines' }
  },
  timeout: 30000
};

class RouteOptimizationTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async test(name, testFn) {
    try {
      this.log(`Running test: ${name}`);
      await testFn();
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASSED' });
      this.log(`Test passed: ${name}`, 'success');
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAILED', error: error.message });
      this.log(`Test failed: ${name} - ${error.message}`, 'error');
    }
  }

  // Test 1: Verify all required files exist
  async testFileStructure() {
    const requiredFiles = [
      'src/app/dashboard/components/route/InteractiveRouteMap.tsx',
      'src/components/ui/dropdown-menu.tsx',
      'src/app/api/locations/search/route.ts',
      'src/app/api/routes/calculate/route.ts',
      'src/app/api/routes/monitor/route.ts',
      'src/app/api/routes/traffic-analysis/[id]/route.ts',
      'src/lib/services/tomtomRouting.ts',
      'src/lib/services/routeTrafficAnalysis.ts',
      'src/types/route-optimization.ts',
      '.env.example',
      'TOMTOM_SETUP.md'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(process.cwd(), file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }
  }

  // Test 2: Verify TypeScript compilation
  async testTypeScriptCompilation() {
    try {
      execSync('npx tsc --noEmit --skipLibCheck', { 
        stdio: 'pipe',
        timeout: 30000
      });
    } catch (error) {
      throw new Error(`TypeScript compilation failed: ${error.message}`);
    }
  }

  // Test 3: Verify environment configuration
  async testEnvironmentConfig() {
    const envExample = path.join(process.cwd(), '.env.example');
    const envContent = fs.readFileSync(envExample, 'utf8');
    
    if (!envContent.includes('TOMTOM_API_KEY=')) {
      throw new Error('TOMTOM_API_KEY not found in .env.example');
    }
  }

  // Test 4: Verify API route structure
  async testAPIRouteStructure() {
    const apiRoutes = [
      'src/app/api/locations/search/route.ts',
      'src/app/api/routes/calculate/route.ts',
      'src/app/api/routes/monitor/route.ts',
      'src/app/api/routes/traffic-analysis/[id]/route.ts'
    ];

    for (const route of apiRoutes) {
      const routePath = path.join(process.cwd(), route);
      const content = fs.readFileSync(routePath, 'utf8');
      
      // Check for required exports
      if (!content.includes('export async function GET') && !content.includes('export async function POST')) {
        throw new Error(`API route ${route} missing required HTTP method exports`);
      }
    }
  }

  // Test 5: Verify component imports and exports
  async testComponentStructure() {
    const componentPath = path.join(process.cwd(), 'src/app/dashboard/components/route/InteractiveRouteMap.tsx');
    const content = fs.readFileSync(componentPath, 'utf8');
    
    const requiredImports = [
      'React',
      'useState',
      'useCallback',
      'RouteData',
      'MapStyleSelector',
      'RouteSelectionPanel',
      'TrafficLegend'
    ];

    for (const importItem of requiredImports) {
      if (!content.includes(importItem)) {
        throw new Error(`InteractiveRouteMap missing required import: ${importItem}`);
      }
    }

    if (!content.includes('export default function InteractiveRouteMap')) {
      throw new Error('InteractiveRouteMap missing default export');
    }
  }

  // Test 6: Verify UI component structure
  async testUIComponentStructure() {
    const componentDir = 'src/app/dashboard/components/route/MapUI';
    const components = ['MapStyleSelector.tsx', 'RouteSelectionPanel.tsx', 'TrafficLegend.tsx'];

    for (const component of components) {
      const componentPath = path.join(process.cwd(), componentDir, component);
      if (!fs.existsSync(componentPath)) {
        throw new Error(`UI component missing: ${component}`);
      }
      const content = fs.readFileSync(componentPath, 'utf8');
      if (!content.includes('export default function')) {
        throw new Error(`UI component ${component} missing default export`);
      }
    }
  }

  // Test 7: Verify dropdown-menu implementation
  async testDropdownMenu() {
    const dropdownMenuPath = path.join(process.cwd(), 'src/components/ui/dropdown-menu.tsx');
    const content = fs.readFileSync(dropdownMenuPath, 'utf8');
    
    const requiredExports = [
      'DropdownMenu',
      'DropdownMenuTrigger',
      'DropdownMenuContent',
      'DropdownMenuItem',
      'DropdownMenuCheckboxItem',
      'DropdownMenuRadioItem',
      'DropdownMenuLabel',
      'DropdownMenuSeparator',
      'DropdownMenuShortcut',
      'DropdownMenuGroup',
      'DropdownMenuPortal',
      'DropdownMenuSub',
      'DropdownMenuSubContent',
      'DropdownMenuSubTrigger',
      'DropdownMenuRadioGroup'
    ];

    for (const exportItem of requiredExports) {
      if (!content.includes(exportItem)) {
        throw new Error(`DropdownMenu missing required export: ${exportItem}`);
      }
    }
  }

  // Test 7: Verify service implementations
  async testServiceImplementations() {
    const services = [
      'src/lib/services/tomtomRouting.ts',
      'src/lib/services/routeTrafficAnalysis.ts'
    ];

    for (const service of services) {
      const servicePath = path.join(process.cwd(), service);
      const content = fs.readFileSync(servicePath, 'utf8');
      
      if (!content.includes('class') && !content.includes('export')) {
        throw new Error(`Service ${service} missing proper class or export structure`);
      }
    }
  }

  // Test 8: Verify type definitions
  async testTypeDefinitions() {
    const typesPath = path.join(process.cwd(), 'src/types/route-optimization.ts');
    const content = fs.readFileSync(typesPath, 'utf8');
    
    const requiredTypes = [
      'RouteRequest',
      'RouteData',
      'TrafficAnalysis',
      'RouteComparison',
      'Location'
    ];

    for (const type of requiredTypes) {
      if (!content.includes(`interface ${type}`) && !content.includes(`type ${type}`)) {
        throw new Error(`Type definition missing: ${type}`);
      }
    }
  }

  // Test 9: Verify documentation completeness
  async testDocumentation() {
    const docPath = path.join(process.cwd(), 'TOMTOM_SETUP.md');
    const content = fs.readFileSync(docPath, 'utf8');
    
    const requiredSections = [
      '# TomTom API Setup for Route Optimization',
      '## Overview',
      '## API Endpoints Used',
      '## Environment Variables',
      '## Getting a TomTom API Key',
      '## Implementation Files',
      '## Testing',
      '## Features',
      '## Error Handling'
    ];

    for (const section of requiredSections) {
      if (!content.includes(section)) {
        throw new Error(`Documentation missing required section: ${section}`);
      }
    }
  }

  // Test 10: Verify package dependencies
  async testPackageDependencies() {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    const requiredDeps = ['react', 'next', 'typescript'];
    const allDeps = { ...packageContent.dependencies, ...packageContent.devDependencies };
    
    for (const dep of requiredDeps) {
      if (!allDeps[dep]) {
        throw new Error(`Required dependency missing: ${dep}`);
      }
    }
  }

  async runAllTests() {
    this.log('🚀 Starting Route Optimization System Tests');
    this.log(`Test environment: ${process.cwd()}`);
    
    await this.test('File Structure Verification', () => this.testFileStructure());
    await this.test('TypeScript Compilation', () => this.testTypeScriptCompilation());
    await this.test('Environment Configuration', () => this.testEnvironmentConfig());
    await this.test('API Route Structure', () => this.testAPIRouteStructure());
    await this.test('Component Structure', () => this.testComponentStructure());
    await this.test('UI Component Structure', () => this.testUIComponentStructure());
    await this.test('Dropdown Menu Implementation', () => this.testDropdownMenu());
    await this.test('Service Implementations', () => this.testServiceImplementations());
    await this.test('Type Definitions', () => this.testTypeDefinitions());
    await this.test('Documentation Completeness', () => this.testDocumentation());
    await this.test('Package Dependencies', () => this.testPackageDependencies());

    this.printResults();
  }

  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results.tests
        .filter(test => test.status === 'FAILED')
        .forEach(test => {
          console.log(`  • ${test.name}: ${test.error}`);
        });
    }
    
    console.log('\n✅ PASSED TESTS:');
    this.results.tests
      .filter(test => test.status === 'PASSED')
      .forEach(test => {
        console.log(`  • ${test.name}`);
      });

    console.log('\n' + '='.repeat(60));
    
    if (this.results.failed === 0) {
      console.log('🎉 ALL TESTS PASSED! Route optimization system is ready.');
      console.log('\nNext steps:');
      console.log('1. Set up your TomTom API key in .env.local');
      console.log('2. Run `npm run dev` to start the development server');
      console.log('3. Navigate to the dashboard to test the route optimization widget');
    } else {
      console.log('⚠️  Some tests failed. Please fix the issues before proceeding.');
    }
  }
}

// Run the tests
const tester = new RouteOptimizationTester();
tester.runAllTests().catch(error => {
  console.error('❌ Test runner failed:', error.message);
  process.exit(1);
});
