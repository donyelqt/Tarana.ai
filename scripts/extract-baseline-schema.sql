-- ============================================================================
-- Baseline extraction for the missing tables.
--
-- WHY THIS EXISTS
--   public.users and public.itineraries are referenced by the migration chain
--   but created by none of its files. They were built by hand in the Supabase
--   SQL Editor, so the live catalogue is the only authority on their shape.
--   Run this, and the output is what the 20231231000000_baseline_*.sql
--   migration should contain.
--
-- HOW TO RUN
--   Supabase dashboard -> SQL Editor -> New query -> paste all of this -> Run.
--   It returns four result grids. Nothing is created or modified.
--
-- Do NOT paste this into a file under supabase/migrations/. It is a read-only
-- inspection tool, not a migration. Only its OUTPUT becomes a migration.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- [1] COLUMNS: name, type, nullability, default
-- ---------------------------------------------------------------------------
select c.relname                            as table_name,
       a.attnum                             as ord,
       quote_ident(a.attname)               as column_name,
       format_type(a.atttypid, a.atttypmod) as data_type,
       a.attnotnull                         as not_null,
       pg_get_expr(ad.adbin, ad.adrelid)    as default_expr
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
left join pg_attrdef ad on ad.adrelid = c.oid and ad.adnum = a.attnum
where n.nspname = 'public'
  and c.relname in ('users', 'itineraries')
order by c.relname, a.attnum;


-- ---------------------------------------------------------------------------
-- [2] CONSTRAINTS: primary key, unique, foreign keys, check
-- ---------------------------------------------------------------------------
select c.relname                      as table_name,
       con.conname                    as constraint_name,
       con.contype                    as kind,   -- p=PK  u=unique  f=FK  c=check
       pg_get_constraintdef(con.oid)  as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('users', 'itineraries')
order by c.relname, con.contype, con.conname;


-- ---------------------------------------------------------------------------
-- [3] INDEXES: includes PK/unique-backing indexes plus explicit ones
-- ---------------------------------------------------------------------------
select tablename  as table_name,
       indexname  as index_name,
       indexdef   as definition
from pg_indexes
where schemaname = 'public'
  and tablename in ('users', 'itineraries')
order by tablename, indexname;


-- ---------------------------------------------------------------------------
-- [4] RLS POLICIES
--   This is why the query exists rather than `pg_dump --schema-only`.
--   20260919000000_saved_meals_rls_remediation.sql records that a hand-applied
--   FIX_SAVED_MEALS_RLS_FINAL.sql produced live policies whose repo copy was
--   deleted in PR #482. Policy state here has already drifted once, so it is
--   read from the live catalogue rather than inferred.
-- ---------------------------------------------------------------------------
select tablename   as table_name,
       policyname  as policy_name,
       cmd         as applies_to,   -- ALL | SELECT | INSERT | UPDATE | DELETE
       roles       as applies_to_roles,
       qual        as using_expression,
       with_check  as with_check_expression
from pg_policies
where schemaname = 'public'
  and tablename in ('users', 'itineraries')
order by tablename, policyname;


-- ---------------------------------------------------------------------------
-- [5] Is RLS switched on, and is it forced (applies even to the table owner)?
-- ---------------------------------------------------------------------------
select c.relname           as table_name,
       c.relrowsecurity    as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('users', 'itineraries');
