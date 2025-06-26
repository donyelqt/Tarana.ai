# Deployment Guide for Tarana.ai

This guide provides instructions for setting up the project for local development and deploying it to production on Vercel.

## 1. Prerequisites

Before you begin, ensure you have the following installed and configured:
- [Node.js](https://nodejs.org/en/) (v18 or later)
- [npm](https://www.npmjs.com/) or [Yarn](https://yarnpkg.com/)
- [Git](https://git-scm.com/)
- A [Vercel](https://vercel.com/) account for deployment.
- A [Supabase](https://supabase.com/) account.
- A [Google Cloud](https://cloud.google.com/) account for Google OAuth credentials.

## 2. Local Development Setup

Follow these steps to get the project running on your local machine.

### Step 1: Clone the Repository
```bash
git clone <your-repo-url>
cd tarana.ai
```

### Step 2: Install Dependencies
```bash
npm install
# or
yarn install
```

### Step 3: Set Up Environment Variables
Create a `.env.local` file in the project root by copying the example below.

```sh
# .env.local

# NextAuth
# Generate a secret: https://generate-secret.vercel.app/32
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""

# Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# API Keys
OPENWEATHER_API_KEY=""
GOOGLE_GEMINI_API_KEY=""

# Supabase
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""
```

Fill in the values by following the instructions in the **Environment Variables** section.

### Step 4: Set Up Supabase
1.  **Link your project**:
    ```bash
    npx supabase login
    npx supabase link --project-ref <your-project-ref>
    ```
2.  **Push database migrations**:
    ```bash
    npx supabase db push
    ```
    This will apply all migrations from the `supabase/migrations` directory to your Supabase database.

### Step 5: Run the Development Server
```bash
npm run dev
# or
yarn dev
```
The application should now be running at [http://localhost:3000](http://localhost:3000).

---

## 3. Environment Variables

| Variable                      | Description                                                                                             | How to Get                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `NEXTAUTH_URL`                | The canonical URL of your production site.                                                              | Your production domain (e.g., `https://tarana-ai.vercel.app`). Vercel sets this automatically.                        |
| `NEXTAUTH_SECRET`             | A secret key used to encrypt JWTs.                                                                      | Generate one using `openssl rand -base64 32` or from [generate-secret.vercel.app](https://generate-secret.vercel.app). |
| `GOOGLE_CLIENT_ID`            | Your Google OAuth client ID.                                                                            | Create OAuth 2.0 credentials in the [Google Cloud Console](https://console.cloud.google.com/).                      |
| `GOOGLE_CLIENT_SECRET`        | Your Google OAuth client secret.                                                                        | From your Google Cloud OAuth credentials.                                                                           |
| `OPENWEATHER_API_KEY`         | Your API key for OpenWeatherMap. **Server-side only.**                                                  | Get it from the [OpenWeatherMap website](https://openweathermap.org/api).                                           |
| `GOOGLE_GEMINI_API_KEY`       | Your API key for Google Gemini. **Server-side only.**                                                   | Get it from [Google AI Studio](https://makersuite.google.com/).                                                    |
| `NEXT_PUBLIC_SUPABASE_URL`    | Your Supabase project URL. (Client-side accessible)                                                     | In your Supabase project settings under "API".                                                                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase project anonymous (public) key. (Client-side accessible)                                  | In your Supabase project settings under "API".                                                                      |
| `SUPABASE_SERVICE_ROLE_KEY`   | Your Supabase project service role key for admin-level access. **Server-side only.**                      | In your Supabase project settings under "API". **Keep this secret.**                                                |

---

## 4. Deployment to Vercel

1.  **Import Project**: Go to your Vercel dashboard and import the project from your Git repository.
2.  **Configure Settings**:
    -   **Framework Preset**: Vercel should automatically detect **Next.js**.
    -   **Build Command**: `npm run build` or `yarn build`.
    -   **Output Directory**: Should be `.next` (default).
3.  **Add Environment Variables**: In the project settings on Vercel, go to **Settings > Environment Variables**. Add all the variables from the table above, ensuring you use the production values (e.g., your production `NEXTAUTH_URL`).
4.  **Deploy**: Trigger a deployment. Vercel will build and deploy your application.

---

## 5. Security Best Practices

-   **NEVER** expose server-side keys (like `OPENWEATHER_API_KEY`, `GOOGLE_GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`) to the client. Do not prefix them with `NEXT_PUBLIC_`.
-   Use server-side API routes or Server Actions to protect sensitive credentials.
-   Keep your `.env.local` file out of version control (it is already in `.gitignore`).
-   For production, consider implementing rate limiting on authentication endpoints to prevent brute-force attacks.

---

## 6. Troubleshooting

If you encounter authentication issues in production:
1.  Verify that all environment variables are correctly set in the Vercel dashboard.
2.  Check that your OAuth provider (Google) has the correct callback URL configured: `https://your-domain.com/api/auth/callback/google`.
3.  Ensure your `NEXTAUTH_SECRET` is properly set.
4.  Check the Vercel deployment logs for any errors related to authentication.