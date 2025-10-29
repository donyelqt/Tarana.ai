# Credit System Testing Guide

## Issue Identified
Your user profile wasn't created in the `user_profiles` table, so credit consumption was failing silently.

## Solution Applied
✅ Added automatic user profile creation in `CreditService`
✅ Created initialization endpoint for existing users

---

## Test Steps

### Step 1: Initialize Your Profile
Run this in your browser console while logged in, or use a tool like Postman:

```javascript
// In browser console (while on your dashboard):
fetch('/api/credits/init-profile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
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

### Step 2: Verify Your Balance
```javascript
fetch('/api/credits/balance')
.then(r => r.json())
.then(d => console.log('Balance:', d))
```

**Expected Response:**
```json
{
  "success": true,
  "balance": {
    "totalCredits": 5,
    "usedToday": 0,
    "remainingToday": 5,
    "tier": "Default",
    "nextRefresh": "2025-01-30T00:00:00.000Z",
    "dailyLimit": 5
  }
}
```

---

### Step 3: Test Credit Consumption

#### Option A: Generate an Itinerary (Tarana Gala)
1. Go to Tarana Gala
2. Generate an itinerary
3. Check server logs - you should see:
   ```
   ✅ Credit consumed for user [your-id] - Tarana Gala
   ```

#### Option B: Search for Food (Tarana Eats)
1. Go to Tarana Eats
2. Search for restaurants
3. Check server logs - you should see:
   ```
   ✅ Credit consumed for user [your-id] - Tarana Eats
   ```

---

### Step 4: Verify Credit Deduction
```javascript
fetch('/api/credits/balance')
.then(r => r.json())
.then(d => console.log('Updated Balance:', d))
```

**Expected Response (after 1 usage):**
```json
{
  "success": true,
  "balance": {
    "totalCredits": 5,
    "usedToday": 1,
    "remainingToday": 4,
    "tier": "Default",
    "nextRefresh": "2025-01-30T00:00:00.000Z",
    "dailyLimit": 5
  }
}
```

---

### Step 5: Check Transaction History
```javascript
fetch('/api/credits/history')
.then(r => r.json())
.then(d => console.log('History:', d))
```

**Expected Response:**
```json
{
  "success": true,
  "history": [
    {
      "id": "...",
      "userId": "your-user-id",
      "transactionType": "spend",
      "amount": -1,
      "serviceUsed": "tarana_gala",
      "description": "Generated itinerary: ...",
      "balanceAfter": 4,
      "createdAt": "2025-01-29T..."
    }
  ],
  "count": 1
}
```

---

## Alternative: Direct Database Check

If you have access to Supabase dashboard:

### Check if profile exists:
```sql
SELECT * FROM user_profiles 
WHERE id = 'your-user-id';
```

### Check credit transactions:
```sql
SELECT * FROM credit_transactions 
WHERE user_id = 'your-user-id' 
ORDER BY created_at DESC;
```

### Manually create profile (if needed):
```sql
INSERT INTO user_profiles (id, current_tier, daily_credits, credits_used_today)
VALUES ('your-user-id', 'Default', 5, 0)
ON CONFLICT (id) DO NOTHING;
```

---

## What Changed

### Before:
- User profile missing → Credit consumption fails silently
- Error caught and logged, but doesn't create profile
- Credits never deducted

### After:
- `ensureUserProfile()` automatically creates profile if missing
- Credit consumption works immediately
- Proper error logging and tracking

---

## Common Issues & Solutions

### Issue: "User profile not found"
**Solution:** Run the init-profile endpoint or wait for automatic creation on next API call

### Issue: Credits still not deducting
**Solution:** 
1. Check browser/server console for errors
2. Verify migration ran successfully
3. Check if `consume_credits` function exists in database:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'consume_credits';
   ```

### Issue: "Database not available"
**Solution:** Verify `SUPABASE_SERVICE_ROLE_KEY` is set in environment variables

---

## Next Steps After Testing

1. ✅ Verify profile creation works
2. ✅ Test credit consumption in both services
3. ✅ Check transaction logging
4. ✅ Test daily refresh (wait until midnight or manually update)
5. ✅ Test referral system
6. ✅ Test tier upgrades

---

## Quick Fixes

### Reset Your Credits (for testing):
```sql
UPDATE user_profiles 
SET credits_used_today = 0 
WHERE id = 'your-user-id';
```

### Check Recent Transactions:
```sql
SELECT 
  transaction_type, 
  amount, 
  service_used, 
  description, 
  balance_after,
  created_at 
FROM credit_transactions 
WHERE user_id = 'your-user-id' 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## Success Indicators

✅ Profile exists in `user_profiles` table
✅ Balance API returns correct data
✅ Credit deduction happens after each generation
✅ Transaction history shows all credit usages
✅ Server logs show "Credit consumed" messages
✅ ReferralModal displays correct balance

---

**If you're still having issues after following these steps, check the server logs for specific error messages and share them for further debugging.**
