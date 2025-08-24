// Simple test runner to verify Jest configuration
const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Testing Jest Configuration...\n');

try {
  // Test 1: Check Jest installation
  console.log('1. Checking Jest installation...');
  const jestVersion = execSync('npx jest --version', { encoding: 'utf8', cwd: __dirname });
  console.log(`✅ Jest version: ${jestVersion.trim()}\n`);

  // Test 2: Run a simple test to verify configuration
  console.log('2. Running email configuration tests...');
  const testResult = execSync('npx jest src/lib/__tests__/emailConfig.test.ts --verbose', { 
    encoding: 'utf8', 
    cwd: __dirname,
    stdio: 'pipe'
  });
  console.log('✅ Email configuration tests passed\n');

  // Test 3: Run email service tests
  console.log('3. Running email service tests...');
  const emailTestResult = execSync('npx jest src/lib/__tests__/email.test.ts --verbose', { 
    encoding: 'utf8', 
    cwd: __dirname,
    stdio: 'pipe'
  });
  console.log('✅ Email service tests passed\n');

  console.log('🎉 All tests are working correctly!');
  
} catch (error) {
  console.error('❌ Test execution failed:');
  console.error(error.message);
  
  if (error.stdout) {
    console.log('\n📋 Test Output:');
    console.log(error.stdout);
  }
  
  if (error.stderr) {
    console.log('\n🚨 Error Details:');
    console.log(error.stderr);
  }
  
  process.exit(1);
}
