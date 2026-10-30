import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
    accessToken?: string
  }

  interface User {
    id: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    accessToken?: string
  }
}