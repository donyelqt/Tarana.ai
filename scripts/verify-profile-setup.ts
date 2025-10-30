/**
 * Verification script for Profile Settings implementation
 * Run this to check if everything is set up correctly
 * 
 * Usage: npx ts-node scripts/verify-profile-setup.ts
 */

import { supabaseAdmin } from '../src/lib/data/supabaseAdmin';

async function verifySetup() {
  console.log('🔍 Verifying Profile Settings Setup...\n');

  let allChecks = true;

  // Check 1: Supabase connection
  console.log('1️⃣ Checking Supabase connection...');
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    console.log('   ✅ Supabase connection successful\n');
  } catch (error) {
    console.log('   ❌ Supabase connection failed:', error);
    allChecks = false;
  }

  // Check 2: Users table structure
  console.log('2️⃣ Checking users table structure...');
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, image, location, bio, updated_at')
      .limit(1);
    
    if (error) throw error;
    
    const requiredColumns = ['id', 'email', 'full_name', 'image', 'location', 'bio', 'updated_at'];
    const hasAllColumns = data !== null;
    
    if (hasAllColumns) {
      console.log('   ✅ All required columns exist:');
      requiredColumns.forEach(col => console.log(`      - ${col}`));
      console.log('');
    } else {
      console.log('   ❌ Missing columns. Please run the migration SQL.');
      allChecks = false;
    }
  } catch (error: any) {
    if (error.message?.includes('column') || error.code === '42703') {
      console.log('   ❌ Missing columns detected. Run the migration:');
      console.log('      File: supabase-migrations/add-profile-fields.sql\n');
      allChecks = false;
    } else {
      console.log('   ❌ Error checking table structure:', error);
      allChecks = false;
    }
  }

  // Check 3: Test user query
  console.log('3️⃣ Testing profile query...');
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, image, location, bio')
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (data) {
      console.log('   ✅ Profile query successful');
      console.log('   📊 Sample user data:');
      console.log(`      - Email: ${data.email}`);
      console.log(`      - Name: ${data.full_name || '(not set)'}`);
      console.log(`      - Location: ${data.location || '(not set)'}`);
      console.log(`      - Bio: ${data.bio ? data.bio.substring(0, 50) + '...' : '(not set)'}`);
      console.log('');
    } else {
      console.log('   ⚠️  No users found in database (this is okay for new setups)\n');
    }
  } catch (error) {
    console.log('   ❌ Error testing profile query:', error);
    allChecks = false;
  }

  // Check 4: API route files
  console.log('4️⃣ Checking API route files...');
  const fs = require('fs');
  const path = require('path');
  
  const apiRoutePath = path.join(process.cwd(), 'src/app/api/profile/route.ts');
  if (fs.existsSync(apiRoutePath)) {
    console.log('   ✅ Profile API route exists\n');
  } else {
    console.log('   ❌ Profile API route not found\n');
    allChecks = false;
  }

  // Check 5: Settings page
  console.log('5️⃣ Checking Settings page...');
  const settingsPagePath = path.join(process.cwd(), 'src/app/settings/page.tsx');
  if (fs.existsSync(settingsPagePath)) {
    const content = fs.readFileSync(settingsPagePath, 'utf-8');
    const hasProfileLogic = content.includes('fetchProfile') && content.includes('handleSave');
    
    if (hasProfileLogic) {
      console.log('   ✅ Settings page has profile functionality\n');
    } else {
      console.log('   ⚠️  Settings page exists but may need updates\n');
    }
  } else {
    console.log('   ❌ Settings page not found\n');
    allChecks = false;
  }

  // Final summary
  console.log('═══════════════════════════════════════════════════');
  if (allChecks) {
    console.log('✅ All checks passed! Profile Settings is ready to use.');
    console.log('\n📝 Next steps:');
    console.log('   1. Start your dev server: npm run dev');
    console.log('   2. Navigate to /settings');
    console.log('   3. Test editing your profile');
  } else {
    console.log('❌ Some checks failed. Please review the errors above.');
    console.log('\n📝 Common fixes:');
    console.log('   1. Run the SQL migration in Supabase');
    console.log('   2. Check your environment variables');
    console.log('   3. Verify Supabase connection');
  }
  console.log('═══════════════════════════════════════════════════\n');
}

// Run verification
verifySetup().catch(console.error);
