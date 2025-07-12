-- Enable pgvector extension (if not already enabled)
create extension if not exists "vector";

-- Create table to store activity embeddings
create table if not exists public.itinerary_embeddings (
    id uuid primary key default uuid_generate_v4(),
    activity_id text not null unique,
    embedding vector(768) not null,
    metadata jsonb default '{}'::jsonb,
    created_at timestamp with time zone default now()
);

-- Create ivfflat index for faster approximate nearest-neighbor searches (requires ANALYZE after populating)
create index if not exists itinerary_embeddings_embedding_idx on public.itinerary_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- RPC helper that returns the top K matches for a given embedding vector.
-- Usage: select * from match_activity_embeddings(array[...], 5);
create or replace function public.match_activity_embeddings(
    query_embedding vector,
    match_count integer default 5
)
returns table (
    activity_id text,
    similarity float,
    metadata jsonb
) language plpgsql as $$
begin
    return query
    select
        ie.activity_id,
        1 - (ie.embedding <#> query_embedding)::float as similarity,
        ie.metadata
    from public.itinerary_embeddings ie
    order by ie.embedding <#> query_embedding
    limit match_count;
end;
$$;

-- Grant execute permissions to anon & authenticated roles
grant execute on function public.match_activity_embeddings(vector, integer) to anon, authenticated; 