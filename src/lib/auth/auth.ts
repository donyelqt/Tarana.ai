import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
// Removed unused direct supabase client import
import { supabaseAdmin } from '../data/supabaseAdmin';
import { ReferralService } from '../referral-system/ReferralService';

// Interface for user data from Supabase (align with your 'users' table structure)
interface SupabaseUser {
  id: string; // Typically a UUID from Supabase
  email: string;
  hashed_password?: string; // Ensure this matches your table column name
  full_name?: string; // Ensure this matches your table column name
  image?: string; // Added for the new image field
  // Add other fields as necessary, e.g., created_at, updated_at
}

// Function to add a new user to Supabase
export async function createUserInSupabase(fullName: string, email: string, password: string) {
  // Check if user already exists using the admin client
  const { data: existingUser, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('email', email.toLowerCase())
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: 'No rows found'
    console.error('Error checking for existing user:', fetchError);
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
    })
    .select('id, full_name, email')
    .single();

  if (insertError) {
    console.error('Error creating user in Supabase:', insertError);
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
    console.error('Error fetching user by email:', error);
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
      async authorize(credentials) {
        // This is where you would typically verify the user credentials against your database
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // rememberMe will be handled in the signin page

        try {
          // Find user by email from Supabase
          const user = await findUserByEmailFromSupabase(credentials.email);

          if (!user || !user.hashed_password) {
            // User not found or password not set
            return null;
          }

          // Verify password using bcrypt against the stored hash
          const isPasswordValid = await bcrypt.compare(credentials.password, user.hashed_password);

          if (!isPasswordValid) {
            // Add a small delay to prevent timing attacks, though bcrypt itself is slow
            await new Promise(resolve => setTimeout(resolve, 250 + Math.random() * 100));
            return null;
          }

          // Return user data (ensure 'name' corresponds to 'full_name' or similar in your SupabaseUser interface)
          return {
            id: user.id,
            name: user.full_name || user.email, // Use full_name if available, otherwise fallback to email
            email: user.email,
            image: user.image,
          };
        } catch (error) {
          console.error('Authentication error:', error);
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
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        try {
          const { data: dbUser, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('id, image')
            .eq('email', user.email.toLowerCase())
            .single();

          if (fetchError && fetchError.code !== 'PGRST116') {
            console.error("Error fetching user during sign-in:", fetchError);
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
                console.error("Error updating user image:", updateError);
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
              console.error("Error creating user during Google sign-in:", insertError);
              return false;
            }
          }
        } catch (e) {
          console.error("Error in signIn callback:", e);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      if (trigger === 'update' && session?.user) {
        token.name = session.user.name ?? token.name;
        token.picture = session.user.image ?? token.picture;
      }

      if (account && user) {
        let resolvedName = token.name as string | undefined;

        if (account.provider === "google") {
          const { data: dbUser } = await supabaseAdmin
            .from('users')
            .select('id, full_name')
            .eq('email', user.email?.toLowerCase())
            .single();

          if (dbUser?.id) {
            token.id = dbUser.id;
          }

          resolvedName = dbUser?.full_name ?? user.name ?? resolvedName;
        } else {
          token.id = user.id;
          resolvedName = user.name ?? resolvedName;
        }

        token.picture = user.image ?? token.picture;
        token.email = user.email ?? token.email;
        token.name = resolvedName ?? token.name;
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

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.image = (token.picture as string) ?? session.user.image;
        if (token.name) {
          session.user.name = token.name as string;
        }
        // Add a mock access token (since we're using admin client, this is just for display)
        session.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};