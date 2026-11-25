create schema if not exists internal;
revoke all on schema internal from public;
grant usage on schema internal to authenticated;

create table public.institutions(id text primary key, name text not null, email_domain text unique);
create table public.education_levels(id text primary key, name text not null);
create table public.courses(id text primary key, name text not null);
create table public.subjects(id text primary key, name text not null unique);
create table public.topics(id text primary key, subject_id text not null references public.subjects, name text not null, unique(subject_id,name));
create table public.geographic_regions(id text primary key, name text not null, kind text not null check(kind in ('residential','neighbourhood','locality','city','district','state','country')), parent_id text references public.geographic_regions);

create table public.profiles(
 id uuid primary key references auth.users on delete cascade,
 alias text not null unique, display_name text check(length(display_name)<=60), identifiable boolean not null default false,
 avatar text not null default 'iris' check(avatar in ('iris','fern','sun','sky')),
 bio text check(length(bio)<=300), institution_id text references public.institutions,
 education_id text references public.education_levels, course_id text references public.courses,
 study_year integer check(study_year between 1 and 10), language text not null default 'English' check(length(language)<=35),
 created_at timestamptz not null default now()
);
create table public.private_profiles(user_id uuid primary key references public.profiles on delete cascade, region_id text references public.geographic_regions, location_opt_in boolean not null default false, suspended_until timestamptz, institution_verified boolean not null default false);
create table public.user_roles(user_id uuid references public.profiles on delete cascade, role text check(role in ('moderator','admin')), primary key(user_id,role));
create table public.user_consents(user_id uuid references public.profiles on delete cascade, kind text check(kind in ('adult-attestation','guidelines')), version integer default 1, granted_at timestamptz not null default now(), primary key(user_id,kind,version));
create table public.student_subjects(user_id uuid references public.profiles on delete cascade, subject_id text references public.subjects on delete cascade, mode text check(mode in ('mentor','learn','interest')), topic text check(length(topic)<=100), primary key(user_id,subject_id,mode));
create table public.student_preferences(user_id uuid primary key references public.profiles on delete cascade, learning_method text check(length(learning_method)<=100), muted_categories text[] not null default '{}');
create table public.student_availability(user_id uuid references public.profiles on delete cascade, slot text check(slot in ('Weekday mornings','Weekday evenings','Weekends')), primary key(user_id,slot));
create table public.blocked_users(owner_id uuid references public.profiles on delete cascade, blocked_id uuid references public.profiles on delete cascade, created_at timestamptz not null default now(), primary key(owner_id,blocked_id),check(owner_id<>blocked_id));
create table public.notifications(id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade, category text not null, title text not null, href text, read_at timestamptz, created_at timestamptz not null default now());
create table internal.rate_events(user_id uuid references public.profiles on delete cascade, action text not null, occurred_at timestamptz not null default now());
create index rate_window on internal.rate_events(user_id,action,occurred_at);
create index notification_inbox on public.notifications(user_id,created_at desc);

create function internal.bootstrap() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce(new.raw_user_meta_data->>'adult','false') <> 'true' then
   raise exception 'StudyCircle requires an 18+ attestation';
 end if;
 loop
   insert into public.profiles(id,alias) values(new.id,'Student-'||right(replace(gen_random_uuid()::text,'-',''),10)) on conflict(alias) do nothing;
   exit when found;
 end loop;
 insert into public.private_profiles(user_id) values(new.id);
 insert into public.student_preferences(user_id) values(new.id);
 insert into public.user_consents(user_id,kind) values(new.id,'adult-attestation'),(new.id,'guidelines');
 return new;
end $$;
create trigger studycircle_registration after insert on auth.users for each row execute function internal.bootstrap();
create function internal.active(person uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.private_profiles p join auth.users u on u.id=p.user_id where p.user_id=person and u.email_confirmed_at is not null and coalesce(p.suspended_until,'-infinity')<=now());
$$;
create function internal.staff(admin_only boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select internal.active(auth.uid()) and exists(select 1 from public.user_roles where user_id=auth.uid() and (role='admin' or (role='moderator' and not admin_only)));
$$;
create function internal.blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.blocked_users where (owner_id=a and blocked_id=b) or (owner_id=b and blocked_id=a));
$$;
create function internal.actor() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 if not internal.active(auth.uid()) then raise exception 'Verify your email or resolve account restrictions first' using errcode='42501'; end if;
 return auth.uid();
end $$;
create function internal.limit_action(kind text, max_events integer, window_length interval) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid := internal.actor();
begin
 perform pg_advisory_xact_lock(hashtextextended(actor::text||kind,0));
 delete from internal.rate_events where user_id=actor and action=kind and occurred_at < now() - interval '2 days';
 if (select count(*) from internal.rate_events where user_id=actor and action=kind and occurred_at>now()-window_length)>=max_events then raise exception 'Too many attempts. Try again later.'; end if;
 insert into internal.rate_events(user_id,action) values(actor,kind);
end $$;
create function internal.check_content(body text, max_length integer, allow_links boolean default false) returns void language plpgsql immutable set search_path='' as $$
begin
 if body is null or length(btrim(body))<1 or length(body)>max_length then raise exception 'The text is empty or exceeds the limit'; end if;
 if body ~* '(javascript:|data:text/html|<script|leaked exam paper|buy exam answers|send nudes|kill yourself|doxx)' or (not allow_links and body ~* '(https?://|www[.])') then
   raise exception 'This text contains a prohibited phrase or link';
 end if;
end $$;
create function internal.notify(person uuid, kind text, label text, destination text) returns void language sql security definer set search_path='' as $$
 insert into public.notifications(user_id, category,title,href)
 select person,kind,label,destination from public.student_preferences where user_id=person and not (kind=any(muted_categories)) and person<>auth.uid();
$$;

create function public.my_role() returns text language sql stable security definer set search_path='' as $$
 select case when internal.staff(true) then 'admin' when internal.staff() then 'moderator' else 'student' end;
$$;
create function public.person(person_id uuid) returns table(id uuid,name text,avatar text,education_id text, institution_id text,bio text)
 language sql stable security definer set search_path='' as $$
 select p.id,coalesce(case when p.identifiable then nullif(p.display_name,'') end,p.alias),p.avatar,p.education_id,
 case when p.identifiable then p.institution_id end,case when p.identifiable then p.bio end
 from public.profiles p where p.id=person_id and internal.active(auth.uid()) and internal.active(p.id) and not internal.blocked(auth.uid(),p.id);
$$;
create function public.set_location(region text, discoverable boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if discoverable and region is null then raise exception 'Choose a region first'; end if;
 update public.private_profiles set region_id=region, location_opt_in=discoverable where user_id=internal.actor();
end $$;

do $$
declare t text;
begin
 foreach t in array array['institutions','education_levels','courses','subjects','topics','geographic_regions'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on public.%I from anon, authenticated',t);
   execute format('grant select on public.%I to authenticated',t);
   execute format('create policy catalog on public.%I for select to authenticated using (true)',t);
 end loop;
 foreach t in array array['profiles','private_profiles','user_roles','user_consents','student_subjects','student_preferences','student_availability','blocked_users','notifications'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on public.%I from anon, authenticated',t);
   execute format('grant select on public.%I to authenticated',t);
   execute format('create policy own on public.%I for select to authenticated using (%I=auth.uid())',t,case when t='profiles' then 'id' when t='blocked_users' then 'owner_id' else 'user_id' end);
 end loop;
 foreach t in array array['student_subjects','student_preferences','student_availability','blocked_users'] loop
   execute format('grant insert,update,delete on public.%I to authenticated',t);
   execute format('create policy own_write on public.%I for all to authenticated using (%I=auth.uid() and internal.active(auth.uid())) with check (%I=auth.uid() and internal.active(auth.uid()))',t,case when t='blocked_users' then 'owner_id' else 'user_id' end,case when t='blocked_users' then 'owner_id' else 'user_id' end);
 end loop;
end $$;
grant update(display_name,identifiable,avatar,bio,institution_id,education_id,course_id,study_year,language) on public.profiles to authenticated;
create policy profile_edit on public.profiles for update to authenticated using(id=auth.uid() and internal.active(auth.uid())) with check(id=auth.uid() and internal.active(auth.uid()));
grant update(read_at) on public.notifications to authenticated;
create policy mark_read on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke execute on all functions in schema internal from public, anon, authenticated;
grant execute on function internal.active(uuid),internal.staff(boolean) to authenticated;

insert into public.subjects values ('math','Engineering Mathematics'),('linear','Linear Algebra'),('physics','Physics'),('chemistry','Chemistry'),('aero','Aerospace Engineering'),('cs','Computer Science'),('programming','Programming'),('bio','Biology');
insert into public.topics values ('eigen','linear','Eigenvalues and eigenvectors'),('vectors','linear','Vector spaces'),('matrices','linear','Matrix transformations'),('calculus','math','Differential calculus'),('dynamics','physics','Dynamics'),('stability','aero','Flight stability'),('python','programming','Python'),('algorithms','cs','Algorithms');
insert into public.education_levels values ('undergrad','Undergraduate'),('postgrad','Postgraduate'),('diploma','Diploma'),('other','Other adult education');
insert into public.courses values ('aero','Aerospace Engineering'),('cs','Computer Science'),('math','Mathematics'),('physics','Physics'),('other','Other');
insert into public.institutions values ('other','Other institution',null);
insert into public.geographic_regions values ('india','India','country',null),('karnataka','Karnataka','state','india'),('bengaluru-urban','Bengaluru Urban','district','karnataka'),('bengaluru','Bengaluru','city','bengaluru-urban'),('south-bengaluru','South Bengaluru','locality','bengaluru'),('jayanagar','Jayanagar','neighbourhood','south-bengaluru'),('pune','Pune','city','india'),('delhi','Delhi','city','india');
