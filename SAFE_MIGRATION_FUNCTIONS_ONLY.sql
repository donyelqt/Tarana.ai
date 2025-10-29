-- =====================================================
-- SAFE MIGRATION - FUNCTIONS ONLY
-- =====================================================
-- This creates only the missing functions without
-- dropping any existing tables or data
-- =====================================================


-- =====================================================
-- TIER CALCULATION FUNCTION
-- =====================================================
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
-- DAILY CREDITS CALCULATION FUNCTION
-- =====================================================
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
-- GET AVAILABLE CREDITS FUNCTION
-- =====================================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- CONSUME CREDITS FUNCTION (CRITICAL!)
-- =====================================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- This script only creates/updates functions.
-- Your existing tables and data are untouched.
-- =====================================================
