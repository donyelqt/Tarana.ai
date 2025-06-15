# Supabase Implementation Plan and Status

This document outlines the current status of Supabase integration in the Tarana.ai project and plans for completing the database implementation.

## Current Status

- **User Authentication:**
    - User registration (`POST /api/auth/register`) is implemented using Supabase. Users are created in a `users` table.
    - Password hashing is done using `bcryptjs` before storing in Supabase.
    - User login (`POST /api/auth/signin` with credentials) is implemented, verifying credentials against the Supabase `users` table.
    - Google OAuth provider is configured in NextAuth, but the callback handling and user creation/linking with Supabase for Google Sign-In might need review and testing.
    - The `users` table in Supabase stores `id`, `full_name`, `email`, and `hashed_password`.
    - `supabaseClient.ts` initializes the public Supabase client.
    - `supabaseAdmin.ts` initializes the Supabase admin client (using `SERVICE_ROLE_KEY`) for operations requiring elevated privileges (like user creation).

- **Saved Itineraries:**
    - CRUD operations for saved itineraries (`getSavedItineraries`, `saveItinerary`, `deleteItinerary`, `updateItinerary`) are implemented in `src/lib/savedItineraries.ts`.
    - These functions interact with an `itineraries` table in Supabase.
    - Itineraries are associated with users via a `user_id` foreign key.
    - Data includes `title`, `date`, `budget`, `image`, `tags`, `formData` (JSONB), `itineraryData` (JSONB), and `weatherData` (JSONB, optional).

## Identified Issues & Fixes

- **FIXED:** The `createUserInSupabase` function was attempting to insert the hashed password into a column named `password` instead of `hashed_password`. This has been corrected in `src/lib/auth.ts`.

## Next Steps and TODOs

### 1. Database Schema Review and Finalization

- **[ ] Review `users` table schema:**
    - Ensure all necessary fields are present (e.g., `created_at`, `updated_at` with default `now()`, `email_verified` if using email verification).
    - Confirm data types and constraints (e.g., `email` should be unique).
- **[ ] Review `itineraries` table schema:**
    - Confirm data types for all fields, especially JSONB fields (`formData`, `itineraryData`, `weatherData`).
    - Ensure `user_id` has a foreign key constraint referencing `users.id` with appropriate `ON DELETE` behavior (e.g., `CASCADE` or `SET NULL`).
    - Add `created_at` and `updated_at` timestamp fields.
- **[ ] Define other potential tables:**
    - `user_preferences` (e.g., travel style, food preferences linked to `users.id`).
    - `feedback` or `reviews` for itineraries or places.
    - `places_of_interest` (if not relying solely on external APIs).

### 2. Row Level Security (RLS)

- **[ ] Implement RLS for `users` table:**
    - Users should only be able to read/update their own profile information (if profile editing is a feature).
    - Admin access might be needed for certain operations.
- **[ ] Implement RLS for `itineraries` table:**
    - Users should only be able to `SELECT`, `INSERT`, `UPDATE`, `DELETE` their own itineraries.
    - The `user_id` column will be crucial for these policies.
    - Example policy for SELECT:
      ```sql
      CREATE POLICY "Users can view their own itineraries." 
      ON itineraries FOR SELECT 
      USING (auth.uid() = user_id);
      ```
    - Example policy for INSERT:
      ```sql
      CREATE POLICY "Users can create their own itineraries." 
      ON itineraries FOR INSERT 
      WITH CHECK (auth.uid() = user_id);
      ```
    - Similar policies for `UPDATE` and `DELETE`.
- **[ ] Implement RLS for any new tables.**

### 3. Supabase Auth Integration Deep Dive

- **[ ] Google Sign-In Flow:**
    - Thoroughly test the Google Sign-In process.
    - Ensure that when a user signs in with Google, a corresponding user record is created in your Supabase `users` table if it doesn't exist, or linked if it does.
    - The `signIn` callback in NextAuth (`src/lib/auth.ts`) might need adjustments to handle this user provisioning in your `users` table, potentially using the `supabaseAdmin` client to create/update user records based on Google profile information.
- **[ ] Email Verification:**
    - Implement Supabase's built-in email verification flow if required.
    - This involves configuring email templates in Supabase and handling the verification link.
- **[ ] Password Reset:**
    - Implement a password reset flow using Supabase Auth features.
    - This typically involves a frontend form to request a reset and an API endpoint to trigger Supabase's password reset email.

### 4. Storage

- **[ ] User Avatars/Profile Pictures:**
    - If users can upload profile pictures, set up Supabase Storage.
    - Define bucket policies for access control (e.g., users can upload to a specific path, public read access for avatars).
- **[ ] Itinerary Images:**
    - Currently, `itinerary.image` is stored as a string (URL). Determine if these images will be hosted externally or if they should be uploaded to Supabase Storage.
    - If using Supabase Storage, update `saveItinerary` and `updateItinerary` to handle image uploads and store the Supabase Storage URL.

### 5. Edge Functions (Optional, based on needs)

- **[ ] Consider if any backend logic is better suited as a Supabase Edge Function.**
    - Example: Complex post-registration processing, webhook handling, etc.

### 6. Testing

- **[ ] Write comprehensive tests for all auth flows (registration, login, Google Sign-In, password reset, email verification).**
- **[ ] Write tests for itinerary CRUD operations, ensuring RLS policies are respected.**

### 7. Environment Variables

- **[ ] Ensure all Supabase-related environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are correctly set up in development and deployment environments.**

## Documentation and Best Practices

- Document Supabase table structures and RLS policies.
- Follow Supabase best practices for security and performance.

This plan provides a roadmap to fully leverage Supabase for the Tarana.ai backend. Regular review and updates to this plan are recommended as the project evolves.