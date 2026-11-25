create table public.matchmaking_queue(
 user_id uuid primary key references public.profiles on delete cascade, intent text not null, subject_id text not null references public.subjects,
 topic text, education_id text references public.education_levels, language text, slot text, duration integer check(duration between 15 and 180),
 scope text not null, group_study boolean not null default false, updated_at timestamptz not null default now()
);
create table internal.discovery_window(user_id uuid references public.profiles on delete cascade, day date, region_key text not null, primary key(user_id,day));
create table public.study_requests(
 id uuid primary key default gen_random_uuid(), sender_id uuid not null references public.profiles on delete cascade,
 recipient_id uuid not null references public.profiles on delete cascade, subject_id text not null references public.subjects, intent text not null default 'Get help',
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
 created_at timestamptz not null default now(), responded_at timestamptz, check(sender_id<>recipient_id)
);
create unique index pending_pair on public.study_requests(least(sender_id,recipient_id),greatest(sender_id,recipient_id)) where status='pending';
create index my_incoming_requests on public.study_requests(recipient_id,created_at desc);
create table public.study_sessions(id uuid primary key default gen_random_uuid(), request_id uuid unique references public.study_requests on delete cascade, subject_id text references public.subjects, started_at timestamptz not null default now(), completed_at timestamptz, minutes integer check(minutes between 0 and 180));
create table public.session_participants(session_id uuid references public.study_sessions on delete cascade,user_id uuid references public.profiles on delete cascade, confirmed_at timestamptz,primary key(session_id,user_id));
create table public.conversations(id uuid primary key default gen_random_uuid(), session_id uuid unique references public.study_sessions on delete cascade, title text not null, created_at timestamptz not null default now());
create table public.conversation_participants(conversation_id uuid references public.conversations on delete cascade,user_id uuid references public.profiles on delete cascade,last_read_at timestamptz,muted boolean not null default false,primary key(conversation_id,user_id));
create table public.messages(id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations on delete cascade, author_id uuid not null references public.profiles on delete cascade, body text not null, reply_to uuid references public.messages on delete set null,created_at timestamptz not null default now(), hidden boolean not null default false);
create index conversation_history on public.messages(conversation_id,created_at desc);
create table public.message_attachments(id uuid primary key default gen_random_uuid(),message_id uuid not null references public.messages on delete cascade,path text not null unique,label text not null);
create table public.accountability_partnerships(id uuid primary key default gen_random_uuid(),session_id uuid not null unique references public.study_sessions on delete cascade, goal text, check_in timestamptz,status text not null default 'active' check(status in ('active','paused','ended')), updated_at timestamptz not null default now());
create table public.review_eligibility(session_id uuid references public.study_sessions on delete cascade,reviewer_id uuid references public.profiles on delete cascade, recipient_id uuid not null references public.profiles on delete cascade, used_at timestamptz, primary key(session_id,reviewer_id),check(reviewer_id<>recipient_id));
create table public.reviews(id uuid primary key default gen_random_uuid(),session_id uuid not null,reviewer_id uuid not null, recipient_id uuid not null references public.profiles on delete cascade, ratings integer[] not null, badge text, feedback text, created_at timestamptz not null default now(),hidden boolean not null default false,unique(session_id,reviewer_id),foreign key(session_id,reviewer_id) references public.review_eligibility on delete cascade);

create index reviews_recipient_active on public.reviews(recipient_id) where not hidden;

create function internal.region_for(anchor text, scope text) returns text language sql stable set search_path='' as $$
 with recursive tree as (select * from public.geographic_regions where id=anchor union all select r.* from public.geographic_regions r join tree t on t.parent_id=r.id)
 select id from tree where kind = case scope when 'radius-2' then 'locality' when 'radius-5' then 'city' when 'radius-10' then 'city' when 'radius-25' then 'district' when 'radius-50' then 'state' else scope end limit 1;
$$;
create function public.find_partners(subject text, intent text, topic text default null, level text default null, preferred_language text default null, slot text default null, duration integer default 50, scope text default 'worldwide', group_study boolean default false)
returns table(id uuid,name text,avatar text,score integer,reasons text[])
language plpgsql security definer set search_path='' as $$
declare actor uuid := internal.actor(); selected_region text; anchor text; cohort integer;
begin
 if scope not in ('worldwide','online','institution','residential','neighbourhood','locality','city','district','state','country','radius-2','radius-5','radius-10','radius-25','radius-50') or intent not in ('Get help','Offer help','Study partner','Exam prep','Group study','Accountability','Topic revision') or length(coalesce(topic,''))>100 or length(coalesce(preferred_language,''))>35 or slot not in ('Weekday mornings','Weekday evenings','Weekends') then raise exception 'Choose a valid search'; end if;
 perform internal.limit_action('discovery',30,interval '1 day');
 if scope not in ('online','worldwide') then
   select p.region_id into anchor from public.private_profiles p where p.user_id=actor and p.location_opt_in;
   if not found then raise exception 'Enable local discovery in your profile before searching this area'; end if;
   if scope='institution' then select institution_id into selected_region from public.profiles where profiles.id=actor and institution_id<>'other';
   else selected_region := internal.region_for(anchor,scope); end if;
   if selected_region is null then return; end if;
   insert into internal.discovery_window values(actor,current_date,selected_region) on conflict do nothing;
   if not exists(select 1 from internal.discovery_window d where d.user_id=actor and day=current_date and d.region_key=selected_region) then
     raise exception 'You can use one local area per day. Worldwide and online search are still available.';
   end if;
   select count(*) into cohort from public.private_profiles p join public.profiles a on a.id=p.user_id
   where p.user_id<>actor and p.location_opt_in and internal.active(p.user_id) and not internal.blocked(actor,p.user_id)
     and case when scope='institution' then a.institution_id else internal.region_for(p.region_id,scope) end=selected_region
     and exists(select 1 from public.student_subjects ss where ss.user_id=p.user_id and ss.subject_id=subject and case when intent='Offer help' then ss.mode='learn' when intent in ('Get help','Topic revision') then ss.mode='mentor' else true end);
 end if;
 insert into public.matchmaking_queue values(actor,intent,subject,topic,level,preferred_language,slot,duration,scope,group_study,now())
 on conflict on constraint matchmaking_queue_pkey do update set intent=excluded.intent,subject_id=excluded.subject_id,topic=excluded.topic,education_id=excluded.education_id,language=excluded.language,slot=excluded.slot,duration=excluded.duration,scope=excluded.scope,group_study=excluded.group_study,updated_at=now();
 if selected_region is not null and cohort<5 then return; end if;
 return query
 select p.id,coalesce(case when p.identifiable then nullif(p.display_name,'') end,p.alias),p.avatar,
  45+20*f.topic_match::int+10*f.level_match::int+10*f.language_match::int+10*f.slot_match::int+5*(selected_region is not null)::int,
  array_remove(array[case when find_partners.intent='Offer help' then 'Needs help with ' when ss.mode='mentor' then 'Can help with ' else 'Also studying ' end||s.name,
    case when f.topic_match then 'Matches your topic' end,case when f.level_match then 'Same education level' end,
    case when f.language_match then 'Speaks '||p.language end,case when f.slot_match then 'Available in your preferred time window' end,
    case when selected_region is not null then 'In your selected study community' end],null)
 from public.profiles p join public.private_profiles pr on pr.user_id=p.id
 join lateral (
  select choice.* from public.student_subjects choice
  where choice.user_id=p.id and choice.subject_id=subject
  and case when find_partners.intent='Offer help' then choice.mode='learn' when find_partners.intent in ('Get help','Topic revision') then choice.mode='mentor' else true end
  order by (lower(choice.topic)=lower(btrim(find_partners.topic))) desc nulls last,(choice.mode='mentor') desc
  limit 1
 ) ss on true
 join public.subjects s on s.id=ss.subject_id
 left join public.matchmaking_queue candidate on candidate.user_id=p.id and candidate.subject_id=subject and candidate.updated_at>now()-interval '7 days'
 cross join lateral (select coalesce(length(btrim(find_partners.topic))>0 and lower(ss.topic)=lower(btrim(find_partners.topic)),false) as topic_match,
   coalesce(p.education_id=level,false) as level_match, coalesce(lower(p.language)=lower(preferred_language),false) as language_match,
   exists(select 1 from public.student_availability a where a.user_id=p.id and a.slot=find_partners.slot) as slot_match) f
 where p.id<>actor and internal.active(p.id) and not internal.blocked(actor,p.id)
   and (selected_region is null or (pr.location_opt_in and (case when find_partners.scope='institution' then p.institution_id else internal.region_for(pr.region_id,find_partners.scope) end)=selected_region))
   and not exists(select 1 from public.study_requests r where r.status in ('pending','declined') and least(r.sender_id,r.recipient_id)=least(actor,p.id) and greatest(r.sender_id,r.recipient_id)=greatest(actor,p.id) and (r.status='pending' or r.created_at>now()-interval '30 days'))
 order by 4 desc,(candidate.group_study=find_partners.group_study and abs(candidate.duration-find_partners.duration)<=20) desc nulls last,
  (select count(distinct reviewer_id)>=3 and avg(ratings[8])>=4 from public.reviews where recipient_id=p.id and not hidden) desc,p.id limit 12;
end $$;

create function internal.session_member(s uuid,actor uuid default auth.uid()) returns boolean language sql stable security definer set search_path='' as $$
 select internal.active(actor) and exists(select 1 from public.session_participants where session_id=s and user_id=actor);
$$;
create function internal.chat_member(chat uuid,actor uuid default auth.uid()) returns boolean language sql stable security definer set search_path='' as $$
 select internal.active(actor) and exists(select 1 from public.conversation_participants where conversation_id=chat and user_id=actor);
$$;
create function public.send_request(target uuid, subject text, purpose text default 'Get help') returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid := internal.actor(); request_id uuid;
begin
 if target=actor or not internal.active(target) or internal.blocked(actor,target) then raise exception 'This student is unavailable'; end if;
 if purpose not in ('Get help','Offer help','Study partner','Exam prep','Group study','Accountability','Topic revision') then raise exception 'Invalid study intent'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(actor,target)::text||greatest(actor,target)::text,0));
 perform internal.limit_action('request',8,interval '1 day');
 if exists(select 1 from public.study_requests where least(sender_id,recipient_id)=least(actor,target) and greatest(sender_id,recipient_id)=greatest(actor,target)
 and ((status='declined' and created_at>now()-interval '30 days') or (status='cancelled' and created_at>now()-interval '1 day'))) then raise exception 'Please give this student some space'; end if;
 if exists(select 1 from public.study_requests r join public.study_sessions s on s.request_id=r.id
 where least(r.sender_id,r.recipient_id)=least(actor,target) and greatest(r.sender_id,r.recipient_id)=greatest(actor,target) and s.completed_at is null) then raise exception 'You already have an open study session together'; end if;
 insert into public.study_requests(sender_id,recipient_id,subject_id,intent) values(actor,target,subject,purpose) returning id into request_id;
 perform internal.notify(target,'requests','New study request','/connect?tab=Requests');
 return request_id;
end $$;
create function public.respond_request(request uuid, decision text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); r public.study_requests; session uuid;
begin
 select * into r from public.study_requests where id=request for update;
 if r.id is null or r.status<>'pending' or decision is null or not ((decision='cancelled' and r.sender_id=actor) or (decision in ('accepted','declined') and r.recipient_id=actor))
 then raise exception 'This request cannot be changed' using errcode='42501'; end if;
 if decision='accepted' and (internal.blocked(r.sender_id,r.recipient_id) or not internal.active(r.sender_id)) then raise exception 'The sender is unavailable'; end if;
 update public.study_requests set status=decision,responded_at=now() where id=request;
 if decision='accepted' then
  insert into public.study_sessions(request_id,subject_id) values(request,r.subject_id) returning id into session;
  insert into public.session_participants(session_id,user_id) values(session,r.sender_id),(session,r.recipient_id);
  insert into public.conversations(id,session_id,title) values(session,session,'Peer study');
  insert into public.conversation_participants(conversation_id,user_id) values(session,r.sender_id),(session,r.recipient_id);
  if r.intent='Accountability' then insert into public.accountability_partnerships(session_id) values(session); end if;
  perform internal.notify(r.sender_id,'requests','Study request accepted','/connect?tab=Messages');
 end if;
 return session;
end $$;
create function public.complete_session(session uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); finished timestamptz;
begin
 if not internal.session_member(session,actor) then raise exception 'Session access denied' using errcode='42501';end if;
 select completed_at into finished from public.study_sessions where id=session for update;
 if finished is not null then return true; end if;
 update public.session_participants set confirmed_at=coalesce(confirmed_at,now()) where session_id=session and user_id=actor;
 if exists(select 1 from public.session_participants where session_id=session and confirmed_at is null) then return false;end if;
 update public.study_sessions set completed_at=now(),minutes=least(180,greatest(0,floor(extract(epoch from now()-started_at)/60)::int)) where id=session;
 insert into public.review_eligibility(session_id,reviewer_id,recipient_id)
 select session,a.user_id,b.user_id from public.session_participants a join public.session_participants b on a.session_id=b.session_id and a.user_id<>b.user_id and not internal.blocked(a.user_id,b.user_id)
 where a.session_id=session on conflict do nothing;
 return true;
end $$;
create function public.submit_review(session uuid,ratings integer[],recognition text default null,note text default null) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); eligible public.review_eligibility;
begin
 select * into eligible from public.review_eligibility where session_id=session and reviewer_id=actor for update;
 if eligible.session_id is null or eligible.used_at is not null or internal.blocked(actor,eligible.recipient_id) then raise exception 'Feedback is unavailable or already submitted'; end if;
 if coalesce(array_length(ratings,1),0)<>8 or exists(select 1 from unnest(ratings) x where x is null or x<1 or x>5) then raise exception 'Select a rating from 1 to 5 for every item'; end if;
 if recognition is not null and recognition not in ('Great explainer','Patient mentor','Very helpful','Reliable study partner','Good communicator','Friendly and respectful','Concept clarity') then raise exception 'Invalid recognition'; end if;
 if nullif(note,'') is not null then perform internal.check_content(note,600); end if;
 insert into public.reviews(session_id,reviewer_id,recipient_id,ratings,badge,feedback) values(session,actor,eligible.recipient_id,ratings,recognition,note);
 update public.review_eligibility set used_at=now() where session_id=session and reviewer_id=actor;
end $$;
create function public.my_review_summary() returns table(review_count bigint, overall numeric, recognition text[]) language sql stable security definer set search_path='' as $$
 select count(distinct reviewer_id),round(avg(ratings[8]),1),array_remove(array_agg(distinct badge),null)
 from public.reviews where recipient_id=internal.actor() and not hidden having count(distinct reviewer_id)>=3;
$$;
create function public.send_message(chat uuid, content text, reply uuid default null, file_path text default null, file_label text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); message uuid; rec record;
begin
 if not internal.chat_member(chat,actor) or exists(select 1 from public.conversations c join public.conversation_participants cp on cp.conversation_id=c.id where c.id=chat and c.session_id is not null and cp.user_id<>actor and (internal.blocked(actor,cp.user_id) or not internal.active(cp.user_id))) then raise exception 'Conversation access denied' using errcode='42501'; end if;
 if reply is not null and not exists(select 1 from public.messages where id=reply and conversation_id=chat and not hidden and not internal.blocked(actor,author_id)) then raise exception 'Reply target unavailable'; end if;
 perform internal.check_content(content,4000);
 perform internal.limit_action('message',30,interval '1 minute');
 if file_path is not null and (file_path not like chat::text||'/'||actor::text||'/%' or not exists(select 1 from storage.objects where bucket_id='study-attachments' and name=file_path)) then raise exception 'Invalid attachment'; end if;
 insert into public.messages(conversation_id,author_id,body,reply_to) values(chat,actor,btrim(content),reply) returning id into message;
 if file_path is not null then insert into public.message_attachments(message_id,path,label) values(message,file_path,left(coalesce(file_label,'Attachment'),180));end if;
 update public.conversation_participants set last_read_at=now() where conversation_id=chat and user_id=actor;
 for rec in select user_id from public.conversation_participants where conversation_id=chat and not muted and user_id<>actor and not internal.blocked(actor,user_id) loop
  perform internal.notify(rec.user_id,'messages','New study message','/connect?tab=Messages');
 end loop;
 return message;
end $$;
create function public.update_partnership(partnership uuid,new_goal text,new_check_in timestamptz,new_status text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor();
begin
 if new_goal is not null then perform internal.check_content(new_goal,500);end if;
 update public.accountability_partnerships a set goal=new_goal,check_in=new_check_in,status=new_status,updated_at=now()
 where a.id=partnership and a.status<>'ended' and internal.session_member(a.session_id,actor)
 and (new_status='ended' or not exists(select 1 from public.session_participants sp where sp.session_id=a.session_id and internal.blocked(actor,sp.user_id)));
 if not found then raise exception 'Partnership unavailable' using errcode='42501';end if;
end $$;

do $$ declare t text; begin
 foreach t in array array['matchmaking_queue','study_requests','study_sessions','session_participants','conversations','conversation_participants','messages','message_attachments','accountability_partnerships','review_eligibility','reviews'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  if t<>'reviews' then execute format('grant select on public.%I to authenticated',t); end if;
 end loop;
end $$;
create policy mq_own on public.matchmaking_queue for select to authenticated using(user_id=auth.uid());
grant delete on public.matchmaking_queue to authenticated;
create policy mq_cancel on public.matchmaking_queue for delete to authenticated using(user_id=auth.uid());
create policy request_own on public.study_requests for select to authenticated using(internal.active(auth.uid()) and auth.uid() in(sender_id,recipient_id));
create policy session_own on public.study_sessions for select to authenticated using(internal.session_member(id));
create policy members_own on public.session_participants for select to authenticated using(internal.session_member(session_id));
create policy chat_own on public.conversations for select to authenticated using(internal.chat_member(id));
create policy chat_members on public.conversation_participants for select to authenticated using(internal.chat_member(conversation_id));
grant update(last_read_at,muted) on public.conversation_participants to authenticated;
create policy chat_prefs on public.conversation_participants for update to authenticated using(user_id=auth.uid() and internal.active(auth.uid())) with check(user_id=auth.uid() and internal.active(auth.uid()));
create policy messages_own on public.messages for select to authenticated using(internal.chat_member(conversation_id) and not hidden and not internal.blocked(auth.uid(),author_id));
create policy file_own on public.message_attachments for select to authenticated using(exists(select 1 from public.messages m where m.id=message_id));
create policy accountability_own on public.accountability_partnerships for select to authenticated using(internal.session_member(session_id));
create policy eligibility_own on public.review_eligibility for select to authenticated using(reviewer_id=auth.uid() and internal.active(auth.uid()));
revoke execute on all functions in schema internal from public,anon,authenticated;
grant execute on function internal.active(uuid),internal.staff(boolean),internal.session_member(uuid,uuid),internal.chat_member(uuid,uuid),internal.blocked(uuid,uuid) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
   alter publication supabase_realtime add table public.messages,public.study_requests,public.study_sessions,public.notifications;
 end if;
end $$;
