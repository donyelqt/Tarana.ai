import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
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

interface SupabaseUser {
  id: string; 
  email: string;
  hashed_password?: string; 
  full_name?: string; 
  image?: string; 
  tos_accepted_at?: string | null; 
}

export async function createUserInSupabase(fullName: string, email: string, password: string, tosAcceptedAt?: string) {
  const { data: existingUser, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('email', email.toLowerCase())
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') { 
    logger.error('Error checking for existing user', { entryPoint: 'auth', ...getSafeErrorMetadata(fetchError) });
    throw new Error('Error checking for existing user');
  }

  if (existingUser) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const { data: newUser, error: insertError } = await supabaseAdmin 
    .from('users')
    .insert({
      full_name: fullName,
      email: email.toLowerCase(),
      hashed_password: hashedPassword, 
      ...(tosAcceptedAt ? { tos_accepted_at: tosAcceptedAt } : {}),
    })
    .select('id, full_name, email')
    .single();

  if (insertError) {
    logger.error('Error creating user in Supabase', { entryPoint: 'auth', ...getSafeErrorMetadata(insertError) });
    throw new Error('Failed to create user');
  }

  return newUser; 
}

export async function findUserByEmailFromSupabase(email: string): Promise<SupabaseUser | null> {
  const { data, error } = await supabaseAdmin 
    .from('users')
    .select('*') 
    .eq('email', email.toLowerCase())
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; 
    logger.error('Error fetching user by email', { entryPoint: 'auth', ...getSafeErrorMetadata(error) });
    return null;
  }
  return data as SupabaseUser;
}

export async function verifySupabaseUserPassword(email: string, suppliedPassword: string): Promise<boolean> {
  const user = await findUserByEmailFromSupabase(email);
  if (!user || !user.hashed_password) {
    return false; 
  }
  return await bcrypt.compare(suppliedPassword, user.hashed_password);
}

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


        try {
          const user = await findUserByEmailFromSupabase(credentials.email);

          if (!user || !user.hashed_password) {
            registerFailedLogin(loginIdentifier);
            return null;
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.hashed_password);

          if (!isPasswordValid) {
            await new Promise(resolve => setTimeout(resolve, 250 + Math.random() * 100));
            registerFailedLogin(loginIdentifier);
            return null;
          }

          resetLoginAttempts(loginIdentifier);

          return {
            id: user.id,
            name: user.full_name || user.email, 
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
    maxAge: 30 * 24 * 60 * 60, 
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, 
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && !user.email) {
        logger.error('Google sign-in refused: missing email', { entryPoint: 'auth' });
        return false;
      }
      if (account?.provider === "google" && user.email) {
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
            return false; 
          }

          if (dbUser) {
            if (dbUser.image !== user.image && user.image) {
              const { error: updateError } = await supabaseAdmin
                .from('users')
                .update({ image: user.image })
                .eq('id', dbUser.id);
              if (updateError) {
                logger.error('Error updating user image', { entryPoint: 'auth', ...getSafeErrorMetadata(updateError) });
              }
            }
          } else {
            const { error: insertError } = await supabaseAdmin
              .from('users')
              .insert({
                full_name: user.name || user.email?.split('@')[0] || "New User",
                email: user.email.toLowerCase(),
                image: user.image,
                hashed_password: "GOOGLE_OAUTH_USER" 
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

      if (!token.accessToken && token.id) {
        token.accessToken = `custom_${token.id}_${Date.now()}`;
      }

      return token;
    },
    async session({ session, token }) {
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
          return {} as unknown as typeof session;
        }
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.image = (token.picture as string) ?? session.user.image;
        if (token.name) {
          session.user.name = token.name as string;
        }
        (session as unknown as { tosAccepted?: boolean }).tosAccepted =
          (token as unknown as { tosAccepted?: boolean }).tosAccepted ?? false;
        session.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};