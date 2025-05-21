import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

// Simple in-memory user storage for demo purposes
// In a real application, you would use a database
let registeredUsers: { email: string; password: string; fullName: string; id: string }[] = [
  // Default demo user
  {
    id: "1",
    email: "user@example.com",
    password: "password",
    fullName: "Demo User"
  }
];

// Function to add a new user (called from register API)
export function addUser(fullName: string, email: string, password: string) {
  const id = (registeredUsers.length + 1).toString();
  registeredUsers.push({ id, fullName, email, password });
  return { id, fullName, email };
}

// Function to find a user by email and password
export function findUserByCredentials(email: string, password: string) {
  return registeredUsers.find(user => user.email === email && user.password === password);
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

        // Check if the user exists in our in-memory storage
        const user = findUserByCredentials(credentials.email, credentials.password);
        
        if (user) {
          return {
            id: user.id,
            name: user.fullName,
            email: user.email,
          };
        }

        // If you return null, an error will be displayed advising the user to check their details
        return null;
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