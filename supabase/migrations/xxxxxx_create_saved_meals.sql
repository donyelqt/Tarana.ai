create table if not exists public.saved_meals (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references public.users(id) on delete cascade not null,
    cafe_name text not null,
    meal_type text not null, -- e.g., Breakfast, Lunch, Dinner, Snack
    price numeric(10,2) not null,
    good_for text, -- e.g., 'Solo', 'Family', etc.
    location text,
    image text, -- URL or path to image
    tags text[],
    menu_items jsonb default '[]'::jsonb, -- array of menu items (optional)
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table public.saved_meals enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can view their own saved meals" on public.saved_meals;
drop policy if exists "Users can create their own saved meals" on public.saved_meals;
drop policy if exists "Users can update their own saved meals" on public.saved_meals;
drop policy if exists "Users can delete their own saved meals" on public.saved_meals;

-- Policy: Users can view their own saved meals
create policy "Users can view their own saved meals" 
on public.saved_meals 
for select 
using (auth.uid() = user_id);

-- Policy: Users can insert their own saved meals
create policy "Users can create their own saved meals" 
on public.saved_meals 
for insert 
with check (auth.uid() = user_id);

-- Policy: Users can update their own saved meals
create policy "Users can update their own saved meals" 
on public.saved_meals 
for update 
using (auth.uid() = user_id);

-- Policy: Users can delete their own saved meals
create policy "Users can delete their own saved meals" 
on public.saved_meals 
for delete 
using (auth.uid() = user_id);