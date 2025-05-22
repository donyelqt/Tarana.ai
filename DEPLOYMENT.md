# Deployment Guide for Tarana.ai

## Environment Variables Configuration

When deploying to production (Vercel), make sure to set up the following environment variables in your Vercel project settings:

### Required Environment Variables

- `NEXTAUTH_URL`: Set this to your production URL (e.g., https://tarana-ai.vercel.app)
- `NEXTAUTH_SECRET`: Your NextAuth secret key for JWT encryption
- `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
- `NEXT_PUBLIC_OPENWEATHER_API_KEY`: Your OpenWeather API key

### Setting Up Environment Variables on Vercel

1. Go to your Vercel dashboard
2. Select your project
3. Go to the "Settings" tab
4. Click on "Environment Variables"
5. Add each of the variables listed above
6. Make sure to select the appropriate environments (Production, Preview, Development)

### Important Notes

- When deploying to Vercel, you don't need to explicitly set the `NEXTAUTH_URL` environment variable as Vercel automatically sets it for you. However, it's still a good practice to set it manually to ensure it works correctly.
- Make sure "Automatically expose System Environment Variables" is checked in your Vercel Project Settings.
- For local development, use the `.env.local` file.
- For production, environment variables should be set in the Vercel dashboard.

## Troubleshooting Authentication Issues

If you encounter authentication issues in production:

1. Verify that all environment variables are correctly set in the Vercel dashboard
2. Check that your OAuth provider (Google) has the correct callback URL configured (should be `https://your-domain.com/api/auth/callback/google`)
3. Ensure your `NEXTAUTH_SECRET` is properly set and matches across environments
4. Check the Vercel deployment logs for any errors related to authentication