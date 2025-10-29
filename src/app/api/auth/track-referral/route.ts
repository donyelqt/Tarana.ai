import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth";
import { ReferralService } from "@/lib/referral-system/ReferralService";
import { CreditService } from "@/lib/referral-system/CreditService";

/**
 * API endpoint to track referrals after user signup
 * Called from frontend after successful authentication
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.error("❌ Unauthorized - no session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    
    // Get referral code from request body
    const body = await req.json();
    const { referralCode } = body;

    if (!referralCode || typeof referralCode !== 'string' || referralCode.trim().length === 0) {
      console.error("❌ Invalid referral code provided");
      return NextResponse.json({ 
        error: "Invalid referral code",
        success: false 
      }, { status: 400 });
    }

    console.log(`📝 Tracking referral for user ${userId} with code: ${referralCode}`);

    // Track the referral with retry logic (profile might not exist immediately)
    let result;
    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} to track referral`);
        
        result = await ReferralService.createReferral({
          referralCode: referralCode.trim().toUpperCase(),
          newUserId: userId
        });
        
        if (result.success) {
          break; // Success, exit retry loop
        } else {
          lastError = result.error;
          console.log(`⚠️ Attempt ${attempt} failed: ${result.error}`);
        }
      } catch (error: any) {
        lastError = error.message;
        console.error(`❌ Attempt ${attempt} threw error:`, error.message);
      }
      
      // Wait before retrying (except on last attempt)
      if (attempt < maxRetries) {
        console.log(`⏳ Waiting 1 second before retry...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (!result) {
      result = { success: false, error: lastError || 'Failed after retries' };
    }

    if (result.success) {
      console.log(`✅ Referral tracked successfully! Referral ID: ${result.referralId}`);
      return NextResponse.json({
        success: true,
        message: "Referral tracked successfully",
        referralId: result.referralId
      });
    } else {
      console.error(`❌ Failed to track referral:`, result.error);
      return NextResponse.json({
        success: false,
        error: result.error || "Unknown error"
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Error tracking referral:", error);
    
    // Handle known error types
    if (error.message?.includes('Invalid referral code')) {
      return NextResponse.json({
        success: false,
        error: "Invalid referral code"
      }, { status: 400 });
    }
    
    if (error.message?.includes('self-referral')) {
      return NextResponse.json({
        success: false,
        error: "You cannot use your own referral code"
      }, { status: 400 });
    }
    
    if (error.message?.includes('already exists')) {
      return NextResponse.json({
        success: false,
        error: "Referral already recorded"
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: "Failed to track referral",
      details: error.message
    }, { status: 500 });
  }
}
