import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Find user by reset token and check if it's still valid
    if (!supabaseAdmin) {
      console.error('Supabase admin client is not initialized.');
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      );
    }

    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, reset_token, reset_token_expiry')
      .eq('reset_token', token)
      .single();

    if (fetchError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Check if token has expired
    const now = new Date();
    const tokenExpiry = new Date(user.reset_token_expiry);
    
    if (now > tokenExpiry) {
      return NextResponse.json(
        { error: 'Reset token has expired' },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user's password and clear reset token
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        hashed_password: hashedPassword,
        reset_token: null,
        reset_token_expiry: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return NextResponse.json(
        { error: 'Failed to reset password' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Password has been reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
