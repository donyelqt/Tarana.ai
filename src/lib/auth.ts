import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";

// Simple in-memory user storage for demo purposes
// In a real application, you would use a database
interface User {
  id: string;
  email: string;
  password: string; // This will store the hashed password
  fullName: string;
}

const registeredUsers: User[] = [
  // Default demo user with hashed password (taranaai123)
  {
    id: "1",
    email: "taranaai@userdemo.com",
    // Pre-hashed password for demo purposes (taranaai123)
    password: "$2a$10$8Ux8HXH9XRlop/P.yONfxeRbDcQfpYl0jVwqOKgS9bTJ7AzNxvJHe",
    fullName: "Demo User"
  }
];

// Function to add a new user (called from register API)
export async function addUser(fullName: string, email: string, password: string) {
  // Check if user already exists
  const existingUser = registeredUsers.find(user => user.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    throw new Error("User with this email already exists");
  }
  
  // Hash the password with a salt factor of 10
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const id = (registeredUsers.length + 1).toString();
  registeredUsers.push({ id, fullName, email, password: hashedPassword });
  
  // Return user without password
  return { id, fullName, email };
}

// Function to find a user by email (without exposing password comparison)
export async function findUserByEmail(email: string) {
  return registeredUsers.find(user => user.email.toLowerCase() === email.toLowerCase());
}

// Function to verify password (using constant-time comparison)
export async function verifyPassword(storedPassword: string, suppliedPassword: string): Promise<boolean> {
  return await bcrypt.compare(suppliedPassword, storedPassword);
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
          // Find user by email first
          const user = await findUserByEmail(credentials.email);
          
          // If no user found or password doesn't match
          if (!user) {
            return null;
          }
          
          // Verify password using constant-time comparison
          const isPasswordValid = await verifyPassword(user.password, credentials.password);
          
          if (!isPasswordValid) {
            // Add a small delay to prevent timing attacks
            await new Promise(resolve => setTimeout(resolve, 250 + Math.random() * 100));
            return null;
          }
          
          // Return user data without password
          return {
            id: user.id,
            name: user.fullName,
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