import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
// Removed unused direct supabase client import
import { supabaseAdmin } from '../data/supabaseAdmin';
import { ReferralService } from '../referral-system/ReferralService';
import { logger } from '@/lib/observability/logger';
import { getSafeErrorMetadata } from '@/lib/observability/safeErrorMetadata';
import {
  getClientIdentifier,
  getLoginBlockStatus,
  registerFailedLogin,
  resetLoginAttempts,
} from './loginThrottle';
import {
  PASSWORD_CHANGED_CLAIM,
  isSessionTokenCurrent,
  readPasswordChangedAt,
  resolveTokenUserId,
} from './sessionValidity';

// Interface for user data from Supabase (align with your 'users' table structure)
interface SupabaseUser {
  id: string; // Typically a UUID from Supabase
  email: string;
  hashed_password?: string; // Ensure this matches your table column name
  full_name?: string; // Ensure this matches your table column name
  image?: string; // Added for the new image field
  tos_accepted_at?: string | null; // ToS/Privacy acceptance timestamp (NULL = not accepted)
  // Add other fields as necessary, e.g., created_at, updated_at
}

// Function to add a new user to Supabase
export async function createUserInSupabase(fullName: string, email: string, password: string, tosAcceptedAt?: string) {
  // Check if user already exists using the admin client
  const { data: existingUser, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('email', email.toLowerCase())
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: 'No rows found'
    logger.error('Error checking for existing user', { entryPoint: 'auth', ...getSafeErrorMetadata(fetchError) });
    throw new Error('Error checking for existing user');
  }

  if (existingUser) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const { data: newUser, error: insertError } = await supabaseAdmin // <--- USE supabaseAdmin
    .from('users')
    .insert({
      full_name: fullName,
      email: email.toLowerCase(),
      hashed_password: hashedPassword, // Changed 'password' to 'hashed_password'
      // Server-enforced ToS acceptance at registration (column added by
      // 20260905000000 migration; omit when absent, e.g. legacy callers).
      ...(tosAcceptedAt ? { tos_accepted_at: tosAcceptedAt } : {}),
    })
    .select('id, full_name, email')
    .single();

  if (insertError) {
    logger.error('Error creating user in Supabase', { entryPoint: 'auth', ...getSafeErrorMetadata(insertError) });
    throw new Error('Failed to create user');
  }

  return newUser; // Returns { id, full_name, email }
}

// Function to find a user by email from Supabase
export async function findUserByEmailFromSupabase(email: string): Promise<SupabaseUser | null> {
  const { data, error } = await supabaseAdmin // <--- USE supabaseAdmin
    .from('users')
    .select('*') // Select all necessary fields, including hashed_password
    .eq('email', email.toLowerCase())
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // User not found
    logger.error('Error fetching user by email', { entryPoint: 'auth', ...getSafeErrorMetadata(error) });
    return null;
  }
  return data as SupabaseUser;
}

// Function to verify password against Supabase user's hashed password
export async function verifySupabaseUserPassword(email: string, suppliedPassword: string): Promise<boolean> {
  const user = await findUserByEmailFromSupabase(email);
  if (!user || !user.hashed_password) {
    return false; // User not found or no password stored
  }
  return await bcrypt.compare(suppliedPassword, user.hashed_password);
}

// Reads the ToS/Privacy acceptance flag for an email. Fail-closed (false) on
// any DB error so the consent gate, not an exception, handles the outcome.
async function fetchTosAccepted(email?: string | null): Promise<boolean> {
  if (!email) return false;
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('tos_accepted_at')
      .eq('email', email.toLowerCase())
      .single();
    if (error) return false;
    return !!(data as { tos_accepted_at?: string | null } | null)?.tos_accepted_at;
  } catch {
    return false;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email"
        }
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        // This is where you would typically verify the user credentials against your database
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const loginIdentifier = getClientIdentifier(credentials.email, req);
        const blockStatus = getLoginBlockStatus(loginIdentifier);

        if (blockStatus.blocked) {
          const error = new Error('Too many login attempts. Please try again later.');
          (error as any).status = 429;
          throw error;
        }

        // rememberMe will be handled in the signin page

        try {
          // Find user by email from Supabase
          const user = await findUserByEmailFromSupabase(credentials.email);

          if (!user || !user.hashed_password) {
            // User not found or password not set
            registerFailedLogin(loginIdentifier);
            return null;
          }

          // Verify password using bcrypt against the stored hash
          const isPasswordValid = await bcrypt.compare(credentials.password, user.hashed_password);

          if (!isPasswordValid) {
            // Add a small delay to prevent timing attacks, though bcrypt itself is slow
            await new Promise(resolve => setTimeout(resolve, 250 + Math.random() * 100));
            registerFailedLogin(loginIdentifier);
            return null;
          }

          resetLoginAttempts(loginIdentifier);

          // Return user data (ensure 'name' corresponds to 'full_name' or similar in your SupabaseUser interface)
          return {
            id: user.id,
            name: user.full_name || user.email, // Use full_name if available, otherwise fallback to email
            email: user.email,
            image: user.image,
          };
        } catch (error) {
          logger.error('Authentication error', { entryPoint: 'auth', ...getSafeErrorMetadata(error) });
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days default
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days default
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && !user.email) {
        // No address to match, link, or provision: deny before any lookup.
        logger.error('Google sign-in refused: missing email', { entryPoint: 'auth' });
        return false;
      }
      if (account?.provider === "google" && user.email) {
        // The row match below is by email alone, so an unverified address
        // would hand an attacker the victim's row (account takeover): the
        // Google userinfo profile asserts `email_verified`, and only a
        // verified address may link to an existing row OR create a new one.
        // Read it from the raw provider profile (`profile`, the userinfo
        // response), not from the mapped `user` (the stock mapper drops it).
        const emailVerified =
          (profile as { email_verified?: unknown } | null | undefined)?.email_verified === true;
        if (!emailVerified) {
          logger.error('Google sign-in refused: email not verified', { entryPoint: 'auth' });
          return false;
        }
        try {
          const { data: dbUser, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('id, image')
            .eq('email', user.email.toLowerCase())
            .single();

          if (fetchError && fetchError.code !== 'PGRST116') {
            logger.error('Error fetching user during sign-in', { entryPoint: 'auth', ...getSafeErrorMetadata(fetchError) });
            return false; // Prevent sign-in if there's a DB error
          }

          if (dbUser) {
            // User exists, update image if it's missing or different
            if (dbUser.image !== user.image && user.image) {
              const { error: updateError } = await supabaseAdmin
                .from('users')
                .update({ image: user.image })
                .eq('id', dbUser.id);
              if (updateError) {
                logger.error('Error updating user image', { entryPoint: 'auth', ...getSafeErrorMetadata(updateError) });
                // Decide if this should prevent sign-in
              }
            }
          } else {
            // New user via Google, create a record in the users table
            const { error: insertError } = await supabaseAdmin
              .from('users')
              .insert({
                full_name: user.name || user.email?.split('@')[0] || "New User",
                email: user.email.toLowerCase(),
                image: user.image,
                hashed_password: "GOOGLE_OAUTH_USER" // Dummy value to satisfy NOT NULL constraint
              });

            if (insertError) {
              logger.error('Error creating user during Google sign-in', { entryPoint: 'auth', ...getSafeErrorMetadata(insertError) });
              return false;
            }
          }
        } catch (e) {
          logger.error('Error in signIn callback', { entryPoint: 'auth', ...getSafeErrorMetadata(e) });
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      if (trigger === 'update') {
        if (session?.user) {
          token.name = session.user.name ?? token.name;
          token.picture = session.user.image ?? token.picture;
        }
        // Refresh the ToS flag so a fresh consent acceptance takes effect
        // without requiring re-login (fail closed on DB errors).
        if (token.email) {
          (token as unknown as { tosAccepted?: boolean }).tosAccepted =
            await fetchTosAccepted(token.email as string);
        }
      }

      if (account && user) {
        let resolvedName = token.name as string | undefined;

        if (account.provider === "google") {
          const { data: dbUser } = await supabaseAdmin
            .from('users')
            .select('id, full_name, tos_accepted_at')
            .eq('email', user.email?.toLowerCase())
            .single();

          let resolvedDbUser = dbUser;
          if (!resolvedDbUser?.id) {
            const { data: rereadDbUser } = await supabaseAdmin
              .from('users')
              .select('id, full_name, tos_accepted_at')
              .eq('email', user.email?.toLowerCase())
              .single();
            resolvedDbUser = rereadDbUser;
          }

          if (!resolvedDbUser?.id) {
            logger.error(
              'Google sign-in failed: no users row exists post-provisioning',
              { entryPoint: 'auth', provider: 'google' }
            );
            throw new Error('auth_user_row_missing');
          }

          token.id = resolvedDbUser.id;

          resolvedName = resolvedDbUser?.full_name ?? user.name ?? resolvedName;
          // First-time Google OAuth provisions with NULL tos_accepted_at, so
          // the post-login middleware gate picks these users up for consent.
          (token as unknown as { tosAccepted?: boolean }).tosAccepted =
            !!(resolvedDbUser as { tos_accepted_at?: string | null } | null)?.tos_accepted_at;
        } else {
          token.id = user.id;
          resolvedName = user.name ?? resolvedName;
          (token as unknown as { tosAccepted?: boolean }).tosAccepted =
            await fetchTosAccepted(user.email);
        }

        token.picture = user.image ?? token.picture;
        token.email = user.email ?? token.email;
        token.name = resolvedName ?? token.name;

        // Pin the current credential-change instant onto this session. `iat`
        // cannot serve this purpose: next-auth re-stamps it on every re-encode
        // (verified), so it records the last cookie write, not the sign-in.
        //
        // The sign-in request performs exactly one read (this one): the
        // `session` callback never runs on the sign-in route (the callback
        // route calls `callbacks.jwt` only), so nothing reads twice here.
        //
        // Null-out is deliberate: when the read fails, a null stamp on a never
        // -changed account still compares equal to the live null. For an
        // account that HAS changed its credential, the next readable refresh
        // rejects the session — fail-closed in the safe direction, and
        // self-healing: a fresh sign-in re-stamps from the live value.
        (token as unknown as Record<string, unknown>)[PASSWORD_CHANGED_CLAIM] =
          (await readPasswordChangedAt(token.id as string)) ?? null;
      }

      if (!token.name && token.email) {
        const { data } = await supabaseAdmin
          .from('users')
          .select('full_name')
          .eq('email', token.email.toLowerCase())
          .single();

        if (data?.full_name) {
          token.name = data.full_name;
        }
      }

      // Generate a simple token identifier (not a real Supabase JWT, just for tracking)
      if (!token.accessToken && token.id) {
        token.accessToken = `custom_${token.id}_${Date.now()}`;
      }

      // The credential-change gate is NOT here. Returning null from this
      // callback only denies a session by accident: the session route still
      // calls the `session` callback with the ORIGINAL decoded token and
      // dereferences `session.user.id` from it, so the denial depends on that
      // dereference throwing (a swallowed TypeError -> JWT_SESSION_ERROR), not
      // on any documented contract. Verified in
      // `scripts/prove-session-invalidation.ts`: a null token is returned to
      // the caller as a live session as soon as the session callback tolerates
      // it. Enforcement lives in the `session` callback, which decides the
      // body explicitly.
      return token;
    },
    async session({ session, token }) {
      // Reject a session whose credential stamp no longer matches the account.
      // Every authorization path in the app resolves identity through
      // `getServerSession`, so returning a user-less session here signs the
      // holder out everywhere at once — web page, API handler, and the mobile
      // synthetic cookie — while the JWT itself stays intact (no DB write, no
      // clock dependence).
      //
      // Checked in `session` rather than in `jwt` because next-auth ignores a
      // null `jwt` return on the session route; it only honours the session
      // callback's body. See the note in `jwt`.
      // Cost, stated plainly: one indexed `users` SELECT per session
      // resolution (server-side, via the `getServerSession` call sites; edge
      // middleware stays a pure decode with no DB import). The sign-in route
      // reads only the single stamp above. No cache by design — a cached value
      // re-opens the window this gate exists to close, and the unreadable read
      // already fails open, so a slow database degrades auth gracefully instead
      // of signing users out.
      const sessionUserId = resolveTokenUserId(token as unknown as Record<string, unknown>);
      if (sessionUserId) {
        const currentChangedAt = await readPasswordChangedAt(sessionUserId);
        const stillValid = isSessionTokenCurrent(
          {
            id: sessionUserId,
            pwdChangedAt:
              ((token as unknown as Record<string, unknown>)[PASSWORD_CHANGED_CLAIM] as
                | string
                | null
                | undefined) ?? null,
          },
          currentChangedAt
        );
        if (!stillValid) {
          logger.warn('Session rejected: token predates the password change', {
            entryPoint: 'auth',
          });
          // An empty object is the only shape that makes next-auth treat the
          // session as absent: `getServerSession` returns null (not a body
          // with `expires` only, which the client would still report as
          // authenticated), and the client's `getSession` maps a key-less
          // body to null -> `status: 'unauthenticated'`. The declared return
          // type cannot express "no session" (it requires `user`/`expires`),
          // so the cast is confined to this one statement.
          return {} as unknown as typeof session;
        }
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.image = (token.picture as string) ?? session.user.image;
        if (token.name) {
          session.user.name = token.name as string;
        }
        // Cheap mirror of the middleware enforcement claim for client use.
        (session as unknown as { tosAccepted?: boolean }).tosAccepted =
          (token as unknown as { tosAccepted?: boolean }).tosAccepted ?? false;
        // Add a mock access token (since we're using admin client, this is just for display)
        session.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};