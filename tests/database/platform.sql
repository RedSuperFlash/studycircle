-- A minimal Supabase schema/role contract for PostgreSQL policy tests.
-- The Docker-backed Playwright suite exercises the real platform services separately.
create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit bypassrls;
create schema auth;
create schema storage;
grant usage on schema auth,storage to anon,authenticated;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,last_sign_in_at timestamptz,raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text not null,owner_id text default auth.uid()::text,unique(bucket_id,name));
alter table storage.objects enable row level security;
grant select,insert,delete on storage.objects to authenticated;
create publication supabase_realtime;
