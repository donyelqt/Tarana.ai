# 🎯 Referral System Setup Guide

## ❌ **The Problem**

Your referral system was **never tracking signups** because:
1. ✅ User profile creation works
2. ✅ Referral code generation works  
3. ❌ **Referral tracking on signup was MISSING**

When someone signed up using your referral link, it created their account but **never created a referral record** in the database.

---

## ✅ **The Solution**

I've created a complete referral tracking system:

### **New Files Created:**

1. `/api/auth/track-referral/route.ts` - API to track referrals
2. `/lib/referral-system/client/referralTracking.ts` - Client-side utilities
3. `REFERRAL_SYSTEM_SETUP.md` - This guide

---

## 🔧 **How to Implement**

### **Step 1: Add Referral Tracking to Layout**

Edit your **root layout** or **main app page** to check for referral codes in URLs:

```typescript
// src/app/layout.tsx or src/app/page.tsx

'use client';

import { useEffect } from 'react';
import { checkAndStoreReferralFromURL } from '@/lib/referral-system/client/referralTracking';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Check for referral code in URL on mount
  useEffect(() => {
    checkAndStoreReferralFromURL();
  }, []);

  return (
    // ... your layout JSX
  );
}
```

**What this does:**
- When someone visits `yoursite.com?ref=7CE8AFFF`
- Automatically stores the referral code in localStorage
- Code expires in 30 days

---

### **Step 2: Track Referral After Signup**

Add this to your **dashboard** or **first page after login**:

```typescript
// src/app/dashboard/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { trackReferralAfterSignup } from '@/lib/referral-system/client/referralTracking';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [referralTracked, setReferralTracked] = useState(false);

  useEffect(() => {
    // Only run once when user is authenticated
    if (status === 'authenticated' && !referralTracked) {
      trackReferralAfterSignup()
        .then(result => {
          if (result.success) {
            console.log('✅ Referral bonus applied!');
            // Optionally show a toast notification
          }
          setReferralTracked(true);
        })
        .catch(err => {
          console.error('Failed to track referral:', err);
          setReferralTracked(true);
        });
    }
  }, [status, referralTracked]);

  return (
    // ... your dashboard JSX
  );
}
```

**What this does:**
- Runs once when user first logs in
- Checks localStorage for stored referral code
- Calls API to create referral record
- Updates referrer's tier and credits automatically (via database triggers)

---

## 🚀 **Testing the System**

### **Test 1: Share Your Referral Link**

1. Get your referral link:
   ```javascript
   // Your referral code: 7CE8AFFF
   const link = `https://yoursite.com?ref=7CE8AFFF`;
   ```

2. Open link in **incognito/private browser**

3. Sign up with a new account

4. After signup, check database:
   ```sql
   SELECT * FROM referrals WHERE referrer_id = '6e7d2131-28d4-4628-bfc2-dfe27dab64c4';
   ```

5. Should show 1 referral with status = 'active'

6. Check your tier:
   ```sql
   SELECT current_tier, daily_credits, active_referrals 
   FROM user_profiles 
   WHERE id = '6e7d2131-28d4-4628-bfc2-dfe27dab64c4';
   ```

7. Should show:
   - `current_tier`: 'Explorer'
   - `daily_credits`: 6
   - `active_referrals`: 1

---

### **Test 2: Debug Endpoint**

```javascript
// Check current referral status
fetch('/api/referrals/debug')
  .then(r => r.json())
  .then(console.log);

// Fix tier if mismatched
fetch('/api/referrals/debug', { method: 'POST' })
  .then(r => r.json())
  .then(console.log);
```

---

## 📊 **How It Works**

### **Full Flow:**

1. **User A shares link:** `yoursite.com?ref=7CE8AFFF`
2. **User B clicks link** → Referral code stored in localStorage
3. **User B signs up** → Account created
4. **User B logs in first time** → `trackReferralAfterSignup()` runs
5. **API creates referral** → Record in `referrals` table
6. **Database trigger fires** → Updates User A's tier
7. **User A gets upgrade** → Explorer tier, 6 credits/day

---

## 🎯 **Tier Progression**

| Active Referrals | Tier | Credits/Day |
|------------------|------|-------------|
| 0 | Default | 5 |
| 1+ | Explorer | 6 |
| 3+ | Smart Traveler | 8 |
| 5+ | Voyager | 10 |

---

## 🔧 **Troubleshooting**

### **Problem: Friend signed up but no referral**

**Check:**
1. Did they use your referral link (`?ref=CODE`)?
2. Did they complete signup?
3. Did they log in after signup?

**Fix:**
- Have them visit your link again while logged in
- It will store the code and track on next page load

### **Problem: Tier not upgrading**

**Check database triggers:**
```sql
-- Check if trigger exists
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'trigger_update_tier_on_referral';
```

**Manual fix:**
```javascript
fetch('/api/referrals/debug', { method: 'POST' })
  .then(r => r.json())
  .then(console.log);
```

---

## ✅ **Quick Start Checklist**

- [ ] Add `checkAndStoreReferralFromURL()` to root layout
- [ ] Add `trackReferralAfterSignup()` to dashboard
- [ ] Test with incognito browser
- [ ] Verify referral created in database
- [ ] Verify tier upgraded

---

## 💡 **Optional Enhancements**

### **1. Show Referral Success Toast**

```typescript
import { toast } from 'sonner'; // or your toast library

trackReferralAfterSignup().then(result => {
  if (result.success) {
    toast.success('Thanks for using a referral code! Your friend will get bonus credits.');
  }
});
```

### **2. Pre-fill Referral Code in Signup Form**

```typescript
const refCode = getStoredReferralCode();
if (refCode) {
  // Show banner: "You're signing up with John's referral! You'll both get bonuses."
}
```

---

## 🎉 **You're All Set!**

Once you implement Steps 1 and 2, your referral system will work automatically!

**Need help?** Check the debug endpoint or run the SQL queries above.
