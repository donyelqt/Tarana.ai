-- =====================================================
-- REFERRAL CREDIT SYSTEM MIGRATION
-- =====================================================
-- Description: Creates tables, triggers, and functions for
--              the referral and credit management system
-- Version: 1.0.0
-- Date: 2025-01-29
-- =====================================================

-- =====================================================
-- 1. USER PROFILES TABLE
-- =====================================================
-- Extends user information with referral and credit data
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    referral_code VARCHAR(10) UNIQUE NOT NULL,
    current_tier VARCHAR(20) DEFAULT 'Default' NOT NULL,
    daily_credits INTEGER DEFAULT 5 NOT NULL,
    credits_used_today INTEGER DEFAULT 0 NOT NULL,
    total_referrals INTEGER DEFAULT 0 NOT NULL,
    active_referrals INTEGER DEFAULT 0 NOT NULL,
    last_credit_refresh TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_tier CHECK (current_tier IN ('Default', 'Explorer', 'Smart Traveler', 'Voyager')),
    CONSTRAINT valid_credits CHECK (daily_credits >= 0 AND credits_used_today >= 0),
    CONSTRAINT valid_referrals CHECK (total_referrals >= 0 AND active_referrals >= 0)
);

-- =====================================================
-- 2. REFERRALS TABLE
-- =====================================================
-- Tracks referral relationships between users
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    referee_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    referral_code VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT unique_referral UNIQUE(referrer_id, referee_id),
    CONSTRAINT no_self_referral CHECK (referrer_id != referee_id),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'inactive'))
);

-- =====================================================
-- 3. CREDIT TRANSACTIONS TABLE
-- =====================================================
-- Logs all credit-related transactions for auditing
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL,
    service_used VARCHAR(50),
    description TEXT,
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('earn', 'spend', 'refresh', 'bonus')),
    CONSTRAINT valid_service CHECK (service_used IS NULL OR service_used IN ('tarana_gala', 'tarana_eats'))
);

-- =====================================================
-- 4. DAILY CREDIT ALLOCATIONS TABLE
-- =====================================================
-- Tracks daily credit allocations for each user
CREATE TABLE IF NOT EXISTS daily_credit_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    allocation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    base_credits INTEGER DEFAULT 5 NOT NULL,
    bonus_credits INTEGER DEFAULT 0 NOT NULL,
    total_credits INTEGER GENERATED ALWAYS AS (base_credits + bonus_credits) STORED,
    tier VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT unique_daily_allocation UNIQUE(user_id, allocation_date),
    CONSTRAINT valid_allocation_tier CHECK (tier IN ('Default', 'Explorer', 'Smart Traveler', 'Voyager'))
);

-- =====================================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_referral_code ON user_profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON user_profiles(current_tier);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_daily_allocations_user_date ON daily_credit_allocations(user_id, allocation_date DESC);

-- =====================================================
-- 6. TIER CALCULATION FUNCTION
-- =====================================================
-- Calculates user tier based on active referrals
CREATE OR REPLACE FUNCTION calculate_user_tier(active_referral_count INTEGER)
RETURNS VARCHAR(20) AS $$
BEGIN
    IF active_referral_count >= 5 THEN
        RETURN 'Voyager';
    ELSIF active_referral_count >= 3 THEN
        RETURN 'Smart Traveler';
    ELSIF active_referral_count >= 1 THEN
        RETURN 'Explorer';
    ELSE
        RETURN 'Default';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 7. DAILY CREDITS CALCULATION FUNCTION
-- =====================================================
-- Calculates daily credits based on tier
CREATE OR REPLACE FUNCTION calculate_daily_credits(tier VARCHAR(20))
RETURNS INTEGER AS $$
BEGIN
    CASE tier
        WHEN 'Voyager' THEN RETURN 10;
        WHEN 'Smart Traveler' THEN RETURN 8;
        WHEN 'Explorer' THEN RETURN 6;
        ELSE RETURN 5;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 8. UPDATE TIER FUNCTION
-- =====================================================
-- Updates user tier and daily credits based on active referrals
CREATE OR REPLACE FUNCTION update_user_tier()
RETURNS TRIGGER AS $$
DECLARE
    v_active_count INTEGER;
    v_new_tier VARCHAR(20);
    v_new_credits INTEGER;
BEGIN
    -- Count active referrals for the referrer
    SELECT COUNT(*) INTO v_active_count
    FROM referrals
    WHERE referrer_id = NEW.referrer_id AND status = 'active';
    
    -- Calculate new tier
    v_new_tier := calculate_user_tier(v_active_count);
    v_new_credits := calculate_daily_credits(v_new_tier);
    
    -- Update user profile
    UPDATE user_profiles
    SET 
        active_referrals = v_active_count,
        current_tier = v_new_tier,
        daily_credits = v_new_credits,
        updated_at = NOW()
    WHERE id = NEW.referrer_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. INCREMENT TOTAL REFERRALS FUNCTION
-- =====================================================
-- Increments total referrals count when a new referral is created
CREATE OR REPLACE FUNCTION increment_total_referrals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_profiles
    SET 
        total_referrals = total_referrals + 1,
        updated_at = NOW()
    WHERE id = NEW.referrer_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. GENERATE UNIQUE REFERRAL CODE FUNCTION
-- =====================================================
-- Generates a unique 8-character referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS VARCHAR(10) AS $$
DECLARE
    v_code VARCHAR(10);
    v_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate 8-character alphanumeric code
        v_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8));
        
        -- Check if code exists
        SELECT EXISTS(SELECT 1 FROM user_profiles WHERE referral_code = v_code) INTO v_exists;
        
        EXIT WHEN NOT v_exists;
    END LOOP;
    
    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 11. AUTO-GENERATE REFERRAL CODE TRIGGER
-- =====================================================
-- Automatically generates a referral code for new user profiles
CREATE OR REPLACE FUNCTION auto_generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
        NEW.referral_code := generate_referral_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 12. UPDATE TIMESTAMP TRIGGER FUNCTION
-- =====================================================
-- Updates the updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 13. CREATE TRIGGERS
-- =====================================================

-- Auto-generate referral code on user profile insert
DROP TRIGGER IF EXISTS trigger_auto_generate_referral_code ON user_profiles;
CREATE TRIGGER trigger_auto_generate_referral_code
    BEFORE INSERT ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_referral_code();

-- Update tier when referral is created or updated
DROP TRIGGER IF EXISTS trigger_update_tier_on_referral ON referrals;
CREATE TRIGGER trigger_update_tier_on_referral
    AFTER INSERT OR UPDATE OF status ON referrals
    FOR EACH ROW
    EXECUTE FUNCTION update_user_tier();

-- Increment total referrals on new referral
DROP TRIGGER IF EXISTS trigger_increment_total_referrals ON referrals;
CREATE TRIGGER trigger_increment_total_referrals
    AFTER INSERT ON referrals
    FOR EACH ROW
    EXECUTE FUNCTION increment_total_referrals();

-- Update timestamp on user_profiles update
DROP TRIGGER IF EXISTS trigger_update_user_profiles_timestamp ON user_profiles;
CREATE TRIGGER trigger_update_user_profiles_timestamp
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 14. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_credit_allocations ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can view their own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Service role can manage all profiles"
    ON user_profiles FOR ALL
    USING (auth.role() = 'service_role');

-- Referrals Policies
CREATE POLICY "Users can view their referrals"
    ON referrals FOR SELECT
    USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

CREATE POLICY "Service role can manage all referrals"
    ON referrals FOR ALL
    USING (auth.role() = 'service_role');

-- Credit Transactions Policies
CREATE POLICY "Users can view their own transactions"
    ON credit_transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all transactions"
    ON credit_transactions FOR ALL
    USING (auth.role() = 'service_role');

-- Daily Credit Allocations Policies
CREATE POLICY "Users can view their own allocations"
    ON daily_credit_allocations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all allocations"
    ON daily_credit_allocations FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- 15. HELPER FUNCTION: GET AVAILABLE CREDITS
-- =====================================================
-- Returns the available credits for a user
CREATE OR REPLACE FUNCTION get_available_credits(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_daily_credits INTEGER;
    v_used_today INTEGER;
    v_last_refresh TIMESTAMP WITH TIME ZONE;
    v_current_date DATE;
BEGIN
    -- Get user credit info
    SELECT daily_credits, credits_used_today, last_credit_refresh
    INTO v_daily_credits, v_used_today, v_last_refresh
    FROM user_profiles
    WHERE id = p_user_id;
    
    -- Check if we need to refresh (new day)
    v_current_date := CURRENT_DATE;
    IF DATE(v_last_refresh) < v_current_date THEN
        -- Reset used credits for new day
        v_used_today := 0;
    END IF;
    
    -- Return available credits
    RETURN GREATEST(0, v_daily_credits - v_used_today);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 16. HELPER FUNCTION: CONSUME CREDITS
-- =====================================================
-- Consumes credits and logs the transaction
CREATE OR REPLACE FUNCTION consume_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_service VARCHAR(50),
    p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_available INTEGER;
    v_daily_credits INTEGER;
    v_used_today INTEGER;
    v_last_refresh TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get current credit status
    SELECT daily_credits, credits_used_today, last_credit_refresh
    INTO v_daily_credits, v_used_today, v_last_refresh
    FROM user_profiles
    WHERE id = p_user_id;
    
    -- Check if we need to refresh (new day in Manila timezone)
    IF DATE(v_last_refresh AT TIME ZONE 'Asia/Manila') < CURRENT_DATE THEN
        v_used_today := 0;
        UPDATE user_profiles
        SET credits_used_today = 0,
            last_credit_refresh = NOW()
        WHERE id = p_user_id;
    END IF;
    
    -- Calculate available credits
    v_available := v_daily_credits - v_used_today;
    
    -- Check if enough credits
    IF v_available < p_amount THEN
        RETURN FALSE;
    END IF;
    
    -- Consume credits
    UPDATE user_profiles
    SET credits_used_today = credits_used_today + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Log transaction
    INSERT INTO credit_transactions (
        user_id,
        transaction_type,
        amount,
        service_used,
        description,
        balance_after
    ) VALUES (
        p_user_id,
        'spend',
        -p_amount,
        p_service,
        p_description,
        v_daily_credits - (v_used_today + p_amount)
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 17. SEED DEFAULT PROFILES FOR EXISTING USERS
-- =====================================================
-- Create user profiles for existing users who don't have one
INSERT INTO user_profiles (id, referral_code, current_tier, daily_credits)
SELECT 
    u.id,
    generate_referral_code(),
    'Default',
    5
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_profiles up WHERE up.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Summary:
-- - 4 core tables created with proper constraints
-- - 9 functions for business logic
-- - 4 triggers for automatic updates
-- - RLS policies for data security
-- - Indexes for query performance
-- - Existing users migrated to new system
-- =====================================================
