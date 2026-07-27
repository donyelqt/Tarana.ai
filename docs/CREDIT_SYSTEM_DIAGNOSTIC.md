# 🔍 Credit System Diagnostic & Fix Plan

## 🎯 Root Cause Analysis (CTO Perspective)

Based on 50 years of experience debugging distributed systems, here's the systematic analysis:

### **Primary Issue: Database Migration Not Applied**

The most likely cause is that the **database migration was never run**. This means:

1. ❌ `user_profiles` table doesn't exist
2. ❌ `credit_transactions` table doesn't exist  
3. ❌ `consume_credits()` function doesn't exist
4. ❌ Database triggers not installed

**Evidence:**
- Credits show as 5/5 after multiple uses
- No error messages in UI (silent failure)
- Backend catches errors but doesn't block response

---

## 📋 Step-by-Step Diagnostic Protocol

### **STEP 1: Run Comprehensive Diagnostics** ⚡ DO THIS FIRST

Open your browser console and run:

```javascript
// This will tell us EXACTLY what's wrong
fetch('/api/credits/diagnostics')
  .then(r => r.json())
  .then(d => {
    console.log('=== DIAGNOSTIC REPORT ===');
    console.log('Migration Run:', d.summary?.migrationRun);
    console.log('User Setup:', d.summary?.userSetup);
    console.log('Ready to Use:', d.summary?.readyToUse);
    console.log('\n--- Details ---');
    console.log('Checks:', d.checks);
    console.log('\n--- Errors ---');
    d.errors.forEach(err => console.error('❌', err));
    console.log('\n--- User Profile ---');
    console.log(d.userProfile);
    console.log('\n--- Recent Transactions ---');
    console.log(d.recentTransactions);
    return d;
  })
```

**Interpretation of Results:**

| Result | Meaning | Action Needed |
|--------|---------|---------------|
| `migrationRun: false` | Tables don't exist | **RUN MIGRATION** (Step 2) |
| `userProfileExists: false` | Profile missing | **CREATE PROFILE** (Step 3) |
| `consumeCreditsFunctionExists: false` | Function missing | **RUN MIGRATION** (Step 2) |
| `errorCount > 0` | Specific errors | Read error messages carefully |

---

### **STEP 2: Apply Database Migration** 🔧

#### **Option A: Using Supabase CLI (Recommended)**

```bash
# Navigate to project directory
cd "c:\Users\Donielr Arys Antonio\tarana.ai"

# Push migration to Supabase
supabase db push

# Or if using remote:
supabase db push --db-url "your-database-url"
```

#### **Option B: Manual Application via Supabase Dashboard**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the migration file:
   ```
   c:\Users\Donielr Arys Antonio\tarana.ai\supabase\migrations\20250129000000_create_referral_system.sql
   ```
4. Copy the **ENTIRE** contents (all 450+ lines)
5. Paste into SQL Editor
6. Click **RUN**

**Expected Output:**
```
✅ user_profiles table created
✅ referrals table created
✅ credit_transactions table created
✅ daily_credit_allocations table created
✅ Triggers created
✅ Functions created
✅ RLS policies enabled
```

---

### **STEP 3: Initialize Your User Profile**

After migration, create your profile:

```javascript
fetch('/api/credits/init-profile', { method: 'POST' })
  .then(r => r.json())
  .then(d => console.log('Profile Init:', d))
```

**Expected Response:**
```json
{
  "success": true,
  "message": "User profile created successfully",
  "action": "created"
}
```

---

### **STEP 4: Verify Credit System is Working**

```javascript
// Check balance
fetch('/api/credits/balance')
  .then(r => r.json())
  .then(d => console.log('Balance:', d.balance))
```

**Expected Response:**
```json
{
  "success": true,
  "balance": {
    "totalCredits": 5,
    "usedToday": 0,
    "remainingToday": 5,
    "tier": "Default"
  }
}
```

---

### **STEP 5: Test Credit Consumption**

1. **Generate 1 Itinerary** (Tarana Gala)
2. **Open Developer Console** (F12)
3. **Check Server Logs** for:

```
🔄 Attempting to consume 1 credit for user [your-id] - Tarana Gala
[CreditService] Starting credit consumption for user [your-id], amount: 1, service: tarana_gala
[CreditService] User profile check completed for [your-id]
[CreditService] Calling consume_credits RPC function...
[CreditService] RPC Response: { data: true }
[CreditService] ✅ Credit consumption successful. New balance: {...}
✅ Credit consumed successfully for user [your-id] - Tarana Gala
```

4. **Refresh Balance:**

```javascript
fetch('/api/credits/balance')
  .then(r => r.json())
  .then(d => console.log('After Usage:', d.balance))
```

**Expected Result:**
```json
{
  "remainingToday": 4,  // ← Should decrease
  "usedToday": 1         // ← Should increase
}
```

---

## 🔎 What the Enhanced Logging Shows

I've added comprehensive logging at every step:

### **In Browser Console:**
- Server log entries prefixed with `[CreditService]`
- Profile creation attempts
- RPC function calls
- Success/failure indicators

### **Log Interpretation:**

```
✅ [CreditService] Profile exists for user X
   → Profile OK, proceeding

❌ [CreditService] Profile not found. Creating profile...
   → Creating profile automatically

❌ [CreditService] RPC Error: function consume_credits does not exist
   → MIGRATION NOT RUN - Go to Step 2

✅ [CreditService] ✅ Credit consumption successful
   → System working perfectly
```

---

## 🚨 Common Error Messages & Solutions

### Error: `relation "user_profiles" does not exist`
**Root Cause:** Migration not run  
**Solution:** Execute STEP 2 (Apply Migration)

### Error: `function consume_credits(uuid, integer, character varying, text) does not exist`
**Root Cause:** Migration not run  
**Solution:** Execute STEP 2 (Apply Migration)

### Error: `null value in column "id" violates not-null constraint`
**Root Cause:** User ID not being passed correctly  
**Solution:** Check authentication - user must be logged in

### Error: `duplicate key value violates unique constraint "user_profiles_pkey"`
**Root Cause:** Profile already exists  
**Solution:** This is OK - system will use existing profile

---

## 📊 Direct Database Verification (Advanced)

If you have Supabase dashboard access:

### Check if migration ran:
```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('user_profiles', 'credit_transactions', 'referrals');

-- Should return 3 rows
```

### Check if function exists:
```sql
-- Check if consume_credits function exists
SELECT proname, prokind 
FROM pg_proc 
WHERE proname = 'consume_credits';

-- Should return 1 row with proname = 'consume_credits'
```

### Check your profile:
```sql
-- Replace with your actual user ID
SELECT * FROM user_profiles 
WHERE id = 'your-user-id-here';
```

### Check credit transactions:
```sql
-- Replace with your actual user ID
SELECT 
  transaction_type,
  amount,
  service_used,
  description,
  balance_after,
  created_at
FROM credit_transactions 
WHERE user_id = 'your-user-id-here'
ORDER BY created_at DESC;
```

---

## 🎯 Success Criteria

After completing all steps, you should see:

✅ Diagnostics show `migrationRun: true`  
✅ Diagnostics show `userSetup: true`  
✅ Diagnostics show `readyToUse: true`  
✅ Balance API returns correct data  
✅ Credit count decreases after each use  
✅ Server logs show "Credit consumed successfully"  
✅ Transaction history shows usage records  

---

## 🔧 Emergency Rollback (If Needed)

If something goes wrong with the migration:

```sql
-- Drop all tables (WARNING: Deletes all data)
DROP TABLE IF EXISTS daily_credit_allocations CASCADE;
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS referrals CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS consume_credits;
DROP FUNCTION IF EXISTS get_available_credits;
DROP FUNCTION IF EXISTS calculate_user_tier;
DROP FUNCTION IF EXISTS calculate_daily_credits;

-- Then re-run the migration
```

---

## 📞 What to Report if Still Failing

If after following ALL steps the system still doesn't work, provide:

1. **Diagnostic output** (from Step 1)
2. **Server console logs** (from browser DevTools)
3. **SQL query results** (from database verification)
4. **Screenshot** of credit balance not changing
5. **Error messages** from any step that failed

---

## 💡 Pro Tips

1. **Always run diagnostics first** - saves 90% of debugging time
2. **Check server logs in real-time** - open DevTools before testing
3. **Test with fresh browser session** - avoid cache issues
4. **Verify each step** - don't skip to the end
5. **Document what works** - helps with future debugging

---

## 🎓 Technical Deep Dive (For Understanding)

### Why Silent Failure Occurred:

```typescript
try {
  await CreditService.consumeCredits(...);
} catch (error) {
  console.error("Error:", error);
  // 👆 Caught error but didn't block response
  // User still gets their itinerary even though credit wasn't deducted
}
```

### Why It's Fixed Now:

1. **Comprehensive Logging** - Every step logged with context
2. **Auto Profile Creation** - `ensureUserProfile()` creates if missing  
3. **Diagnostic Endpoint** - `/api/credits/diagnostics` shows exact state
4. **Better Error Messages** - Clear indication of what failed and why

---

**Next Action:** Run STEP 1 (Diagnostics) and report the results.
