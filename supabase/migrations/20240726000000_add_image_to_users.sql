ALTER TABLE public.users ADD COLUMN image TEXT;

-- Assuming RLS is enabled on your users table, you might need to adjust policies.
-- However, since the auth.ts logic uses supabaseAdmin, it should bypass RLS.
-- If you face permission issues after adding the column, you may need to
-- update your RLS policies for the users table to allow read/write on the 'image' column.

-- For example, to allow users to update their own image:
-- CREATE POLICY "Users can update their own image"
-- ON public.users
-- FOR UPDATE
-- USING (auth.uid() = id)
-- WITH CHECK (auth.uid() = id);

-- To allow signed-in users to view images:
-- CREATE POLICY "Allow authenticated users to view user images"
-- ON public.users
-- FOR SELECT
-- USING (auth.role() = 'authenticated'); 