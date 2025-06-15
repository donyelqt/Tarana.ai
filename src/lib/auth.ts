import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { supabase } from "./supabaseClient"; // Import Supabase client
import { supabaseAdmin } from './supabaseAdmin'; // Or initialize directly here

// Interface for user data from Supabase (align with your 'users' table structure)
interface SupabaseUser {
  id: string; // Typically a UUID from Supabase
  email: string;
  hashed_password?: string; // Ensure this matches your table column name
  full_name?: string; // Ensure this matches your table column name
  // Add other fields as necessary, e.g., created_at, updated_at
}

// Function to add a new user to Supabase
export async function createUserInSupabase(fullName: string, email: string, password: string) {
  // Check if user already exists using the admin client
  const { data: existingUser, error: fetchError } = await supabaseAdmin // <--- USE supabaseAdmin
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
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};