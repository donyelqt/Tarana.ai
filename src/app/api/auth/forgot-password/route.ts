import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findUserByEmailFromSupabase } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await findUserByEmailFromSupabase(email);
    
    // Always return success to prevent email enumeration attacks
    if (!user) {
      return NextResponse.json({
        message: 'If an account with that email exists, we have sent a password reset link.'
      });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Store reset token in database
    if (!supabaseAdmin) {
      console.error('Supabase admin client is not initialized.');
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        reset_token: resetToken,
        reset_token_expiry: resetTokenExpiry.toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error storing reset token:', updateError);
      return NextResponse.json(
        { error: 'Failed to process reset request' },
        { status: 500 }
      );
    }

    // Send password reset email
    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`;
    
    // Import email service dynamically to avoid issues
    const { sendPasswordResetEmail } = await import('@/lib/email');
    const emailSent = await sendPasswordResetEmail(email, resetUrl);
    
    if (!emailSent) {
      console.warn('Failed to send password reset email, but continuing for security');
    }

    return NextResponse.json({
      message: 'If an account with that email exists, we have sent a password reset link.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
