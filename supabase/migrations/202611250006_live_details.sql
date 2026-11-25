-- Make archived group chats inaccessible while preserving moderation evidence.
create or replace function internal.chat_member(chat uuid,actor uuid default auth.uid()) returns boolean language sql stable security definer set search_path='' as $$
 select internal.active(actor) and exists(select 1 from public.conversation_participants cp
 left join public.study_groups g on g.id=cp.conversation_id
 where cp.conversation_id=chat and cp.user_id=actor and (g.id is null or not g.archived));
$$;

create table public.chat_presence(conversation_id uuid not null references public.conversations on delete cascade,user_id uuid not null references public.profiles on delete cascade,seen_at timestamptz not null default now(),typing_at timestamptz,primary key(conversation_id,user_id));
alter table public.chat_presence enable row level security;
revoke all on public.chat_presence from authenticated,anon;
grant select on public.chat_presence to authenticated;
create policy presence_participants on public.chat_presence for select to authenticated using(internal.chat_member(conversation_id) and not internal.blocked(auth.uid(),user_id));
create function public.chat_signal(chat uuid,typing boolean) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor();
begin
 if not internal.chat_member(chat,actor) then raise exception 'Conversation access denied';end if;
 insert into public.chat_presence(conversation_id,user_id,seen_at,typing_at) values(chat,actor,now(),case when typing then now() end)
 on conflict(conversation_id,user_id) do update set seen_at=now(),typing_at=case when typing then now() else public.chat_presence.typing_at end
 where public.chat_presence.seen_at<now()-interval '1 second';
end $$;
create view public.chat_unread with(security_invoker=true) as
 select p.conversation_id,p.user_id,count(m.id)::int unread from public.conversation_participants p
 left join public.messages m on m.conversation_id=p.conversation_id and m.author_id<>p.user_id and m.created_at>coalesce(p.last_read_at,'-infinity'::timestamptz)
 where p.user_id=auth.uid() group by p.conversation_id,p.user_id;
revoke all on public.chat_unread from anon,authenticated;
grant select on public.chat_unread to authenticated;

create table internal.reminder_keys(user_id uuid references public.profiles on delete cascade,item_id uuid,kind text,scheduled_day date,primary key(user_id,item_id,kind,scheduled_day));
create function public.sync_reminders(local_day date) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 if not internal.active(auth.uid()) or abs(local_day-current_date)>1 then return;end if;
 actor:=auth.uid();
 with candidates as (
  select id,'task' kind,due_on due,'A study task is due' title,'/study?tab=Planner' href from public.study_tasks where user_id=actor and not done and due_on=local_day
  union all select id,'exam',exam_on,'An examination is coming up','/study?tab=Exams' from public.examinations where user_id=actor and exam_on between local_day and local_day+3
  union all select r.id,'room',r.scheduled_at::date,'A group study session is coming up','/study?tab=Rooms&room='||r.id from public.study_rooms r join public.study_group_members m on m.group_id=r.id join public.study_groups g on g.id=r.id where m.user_id=actor and m.status='active' and not g.archived and r.scheduled_at between now() and now()+interval '24 hours'
  union all select p.id,'accountability',p.check_in::date,'Your accountability check-in is coming up','/connect?tab=Accountability' from public.accountability_partnerships p join public.session_participants m on m.session_id=p.session_id where m.user_id=actor and p.status='active' and p.check_in between now() and now()+interval '24 hours'
  union all select actor,'feedback',max(r.created_at)::date,'Your anonymous feedback summary has an update','/profile?tab=Progress' from public.reviews r where r.recipient_id=actor and not r.hidden and r.created_at<now()-interval '24 hours' group by r.recipient_id having count(distinct r.reviewer_id)>=3
 ), allowed as (
   select c.*,case when c.kind='feedback' then 'feedback' else 'study' end category from candidates c
   where not exists(select 1 from public.student_preferences p where p.user_id=actor and (case when c.kind='feedback' then 'feedback' else 'study' end)=any(p.muted_categories))
 ), sent as (
  insert into internal.reminder_keys(user_id,item_id,kind,scheduled_day) select actor,id,kind,due from allowed on conflict do nothing returning item_id,kind,scheduled_day
 )
 insert into public.notifications(user_id,category,title,href) select actor,c.category,c.title,c.href from allowed c join sent s on s.item_id=c.id and s.kind=c.kind and s.scheduled_day=c.due;
end $$;

-- Pause future writes before the account deletion function removes private files.
create function public.begin_account_deletion(actor uuid) returns void language sql security definer set search_path='' as $$
 update public.private_profiles set suspended_until='infinity' where user_id=actor;
$$;
revoke all on function public.begin_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.begin_account_deletion(uuid) to service_role;
create function public.account_object_paths(actor uuid,bucket text) returns setof text language sql stable security definer set search_path='' as $$
 select name from storage.objects where bucket_id=bucket and owner_id=actor::text and bucket in ('study-attachments','study-resources','study-question-files') limit 100;
$$;
revoke all on function public.account_object_paths(uuid,text) from public,anon,authenticated;
grant execute on function public.account_object_paths(uuid,text) to service_role;
revoke all on function public.chat_signal(uuid,boolean),public.sync_reminders(date) from public,anon,authenticated;
grant execute on function public.chat_signal(uuid,boolean),public.sync_reminders(date) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.chat_presence,public.conversations,public.message_attachments;
 end if;
end $$;
