import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';

// GET - Fetch user profile
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, image, location, bio')
      .eq('email', session.user.email.toLowerCase())
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: user.id,
        email: user.email,
        fullName: user.full_name || '',
        image: user.image || '',
        location: user.location || '',
        bio: user.bio || '',
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Update user profile
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { fullName, location, bio } = body;

    // Validation
    if (!fullName || fullName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Full name is required' },
        { status: 400 }
      );
    }

    if (fullName.length > 100) {
      return NextResponse.json(
        { error: 'Full name must be less than 100 characters' },
        { status: 400 }
      );
    }

    if (location && location.length > 200) {
      return NextResponse.json(
        { error: 'Location must be less than 200 characters' },
        { status: 400 }
      );
    }

    if (bio && bio.length > 500) {
      return NextResponse.json(
        { error: 'Bio must be less than 500 characters' },
        { status: 400 }
      );
    }

    // Update user profile
    const { data: updatedUser, error } = await supabaseAdmin
      .from('users')
      .update({
        full_name: fullName.trim(),
        location: location?.trim() || null,
        bio: bio?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('email', session.user.email.toLowerCase())
      .select('id, email, full_name, image, location, bio')
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      profile: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.full_name || '',
        image: updatedUser.image || '',
        location: updatedUser.location || '',
        bio: updatedUser.bio || '',
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
