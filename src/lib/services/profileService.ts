import { supabaseAdmin } from '@/lib/data/supabaseAdmin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  image: string | null;
  location: string | null;
  bio: string | null;
}

export interface ProfileUpdate {
  fullName: string;
  location?: string;
  bio?: string;
}

const PROFILE_COLUMNS = 'id, email, full_name, image, location, bio';

/**
 * Fetch a profile by email. Email is lowercased here so every caller gets
 * the same lookup. Throws on DB error — the route maps that to 500.
 *
 * The route owns auth (withAuthEmail) and the HTTP shape; this service owns
 * the DB read so the route can be unit-tested by mocking one function
 * instead of the whole Supabase client chain.
 */
export async function getProfileByEmail(email: string): Promise<UserProfile> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select(PROFILE_COLUMNS)
    .eq('email', email.toLowerCase())
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch profile: ${error?.message ?? 'not found'}`);
  }

  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    image: data.image,
    location: data.location,
    bio: data.bio,
  };
}

/**
 * Update a profile by email. Fields arrive sanitized and validated by the
 * route; the timestamp is a DB-write concern, so it lives here. Throws on
 * DB error — the route maps that to 500.
 */
export async function updateProfileByEmail(
  email: string,
  update: ProfileUpdate
): Promise<UserProfile> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .update({
      full_name: update.fullName,
      location: update.location ?? null,
      bio: update.bio ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('email', email.toLowerCase())
    .select(PROFILE_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(`Failed to update profile: ${error?.message ?? 'not found'}`);
  }

  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    image: data.image,
    location: data.location,
    bio: data.bio,
  };
}
