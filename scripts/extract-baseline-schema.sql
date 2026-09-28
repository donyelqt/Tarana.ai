-- ============================================================================
-- Baseline extraction: everything in ONE result grid.
--
-- WHY ONE STATEMENT
--   The previous version was five separate SELECTs. Supabase's SQL Editor only
--   renders the LAST statement's result, so only the RLS-enabled grid came
--   back. A single statement with UNION ALL returns all five datasets in one
--   grid, in one copy-paste.
--
-- HOW TO RUN
--   Supabase dashboard -> SQL Editor -> New query -> paste all of this -> Run.
--   Read-only. Creates and modifies nothing.
--
-- READING THE OUTPUT
--   Sort by `section` then `table_name`. Sections:
--     1_COLUMN      every column: type, nullability, default
--     2_CONSTRAINT  primary key, unique, foreign keys, checks
--     3_INDEX       PK/unique-backing indexes plus explicit ones
--     4_POLICY      RLS policies: command, roles, USING, WITH CHECK
--     5_RLS         whether RLS is enabled and forced
-- ============================================================================

with tbl as (
  select c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('users', 'itineraries')
),
cols as (
  select t.relname as table_name,
         a.attnum  as ord,
         quote_ident(a.attname) as item,
         format_type(a.atttypid, a.atttypmod) as data_type,
         a.attnotnull as not_null,
         pg_get_expr(ad.adbin, ad.adrelid) as default_expr
  from tbl t
  join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef ad on ad.adrelid = t.oid and ad.adnum = a.attnum
),
cons as (
  select t.relname as table_name,
         con.conname as item,
         con.contype::text as con_kind,   -- "char" -> text, so || is unambiguous
         pg_get_constraintdef(con.oid) as definition
  from tbl t
  join pg_constraint con on con.conrelid = t.oid
),
idx as (
  select i.tablename as table_name, i.indexname as item, i.indexdef as definition
  from pg_indexes i
  where i.schemaname = 'public' and i.tablename in ('users', 'itineraries')
),
pol as (
  select p.tablename as table_name, p.policyname as item, p.cmd, p.roles,
         p.qual, p.with_check
  from pg_policies p
  where p.schemaname = 'public' and p.tablename in ('users', 'itineraries')
)

select '1_COLUMN' as section,
       table_name,
       ord,
       item,
       data_type
         || case when not_null then ' NOT NULL' else '' end
         || coalesce(' DEFAULT ' || default_expr, '') as detail
from cols

union all

select '2_CONSTRAINT',
       table_name,
       0,
       item,
       -- contype is Postgres's internal "char" type, not text. Without the cast,
       -- `"char" || unknown` is ambiguous and Postgres raises
       -- 42725 operator is not unique. Seen live in the Supabase SQL Editor.
       con_kind || '  ' || definition
from cons

union all

select '3_INDEX',
       table_name,
       0,
       item,
       definition
from idx

union all

select '4_POLICY',
       table_name,
       0,
       item,
       cmd || '  roles=' || roles::text
           || '  USING=' || coalesce(qual, '-')
           || '  CHECK=' || coalesce(with_check, '-')
from pol

union all

select '5_RLS',
       relname,
       0,
       'rls_enabled / rls_forced',
       relrowsecurity::text || ' / ' || relforcerowsecurity::text
from tbl

order by section, table_name, ord, item;
