create policy "Users can create their own itineraries"
on itineraries for insert
with check (auth.uid() = user_id);

create policy "Users can update their own itineraries"
on itineraries for update
using (auth.uid() = user_id);

-- Enable RLS on itineraries table
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;

-- Allow users to select their own itineraries
create policy "Users can view their own itineraries"
on itineraries for select
using (auth.uid() = user_id);

-- Allow users to delete their own itineraries
create policy "Users can delete their own itineraries"
on itineraries for delete
using (auth.uid() = user_id);