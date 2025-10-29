-- Run this in Supabase SQL Editor to check your referrals

-- 1. Check your user profile
SELECT 
  id,
  referral_code,
  current_tier,
  daily_credits,
  total_referrals,
  active_referrals,
  last_credit_refresh
FROM user_profiles
WHERE referral_code = '7CE8AFFF';

-- 2. Check all referrals where you are the referrer
SELECT 
  id,
  referrer_id,
  referee_id,
  referral_code,
  status,
  created_at,
  activated_at
FROM referrals
WHERE referrer_id = '6e7d2131-28d4-4628-bfc2-dfe27dab64c4';

-- 3. Check if your friend has a user profile
SELECT 
  id,
  referral_code,
  current_tier,
  created_at
FROM user_profiles
WHERE id IN (
  SELECT referee_id 
  FROM referrals 
  WHERE referrer_id = '6e7d2131-28d4-4628-bfc2-dfe27dab64c4'
);

-- 4. Force update tier (if referrals exist but tier not updated)
UPDATE user_profiles
SET 
  current_tier = calculate_user_tier(active_referrals),
  daily_credits = calculate_daily_credits(calculate_user_tier(active_referrals)),
  updated_at = NOW()
WHERE id = '6e7d2131-28d4-4628-bfc2-dfe27dab64c4'
RETURNING current_tier, daily_credits, active_referrals;
