import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';

/**
 * Records ToS/Privacy acceptance for the signed-in user.
 * Used by the post-login consent gate (/auth/consent).
 */
export const POST = withAuth(async (_req: NextRequest, userId: string) => {
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from('users')
    .update({ tos_accepted_at: now })
    .eq('id', userId);

  if (error) {
    console.error('Error recording ToS acceptance:', error);
    return NextResponse.json(
      { error: 'Could not record acceptance. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, tos_accepted_at: now });
});
