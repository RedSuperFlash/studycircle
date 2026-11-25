-- One eligible review per direction and pair in any 30-day window. Serializes
-- competing session completions for the same participants.
create or replace function public.complete_session(session uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); finished timestamptz; first_person uuid; second_person uuid;
begin
 if not internal.session_member(session,actor) then raise exception 'Session access denied' using errcode='42501';end if;
 select completed_at into finished from public.study_sessions where id=session for update;
 if finished is not null then return true; end if;
 update public.session_participants set confirmed_at=coalesce(confirmed_at,now()) where session_id=session and user_id=actor;
 if exists(select 1 from public.session_participants where session_id=session and confirmed_at is null) then return false;end if;
 select user_id into first_person from public.session_participants where session_id=session order by user_id limit 1;
 select user_id into second_person from public.session_participants where session_id=session order by user_id desc limit 1;
 perform pg_advisory_xact_lock(hashtextextended(first_person::text||second_person::text,1));
 update public.study_sessions set completed_at=now(),minutes=least(180,greatest(0,floor(extract(epoch from now()-started_at)/60)::int)) where id=session;
 insert into public.review_eligibility(session_id,reviewer_id,recipient_id)
 select session,a.user_id,b.user_id from public.session_participants a
 join public.session_participants b on a.session_id=b.session_id and a.user_id<>b.user_id and not internal.blocked(a.user_id,b.user_id)
 where a.session_id=session and not exists(
  select 1 from public.review_eligibility e join public.study_sessions s on s.id=e.session_id
  where e.session_id<>session and e.reviewer_id=a.user_id and e.recipient_id=b.user_id and s.completed_at>now()-interval '30 days'
 ) on conflict do nothing;
 return true;
end $$;

-- A private recipient can see notes without reviewer IDs, session IDs or
-- timestamps. Delay visibility and require a sufficient distinct reviewer pool.
create function public.my_review_notes() returns table(id uuid,note text) language sql stable security definer set search_path='' as $$
 with person as (select internal.actor() actor), cohort as (
  select r.id,r.reviewer_id,r.feedback from public.reviews r,person p
  where r.recipient_id=p.actor and not r.hidden and r.created_at < now()-interval '24 hours'
 )
 select c.id,c.feedback from cohort c
 where c.feedback is not null and (select count(distinct reviewer_id) from cohort)>=3
 order by c.id limit 30;
$$;
revoke all on function public.my_review_notes() from public,anon,authenticated;
grant execute on function public.my_review_notes() to authenticated;

-- A question and its answers may each have an opaque educational attachment.
alter table public.answers add column attachment_path text unique;
alter table public.answers add column attachment_label text;
drop function public.add_answer(uuid,text);
create function public.add_answer(question uuid,content text,file_path text default null,file_label text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); owner_id uuid; result uuid;
begin
 perform internal.limit_action('answer',15,interval '1 hour');
 perform internal.check_content(content,7000);
 select o.user_id into owner_id from public.questions q left join internal.question_owners o on q.id=o.question_id where q.id=question and not q.hidden for update of q;
 if not found or internal.blocked(actor,owner_id) then raise exception 'Question unavailable';end if;
 if file_path is not null and (file_path !~ '^questions/[0-9a-f-]{36}[.][a-z]+$' or not exists(select 1 from storage.objects s where s.bucket_id='study-question-files' and s.name=file_path and s.owner_id=actor::text)) then raise exception 'Invalid attachment';end if;
 insert into public.answers(question_id,author_id,body,attachment_path,attachment_label) values(question,actor,content,file_path,left(file_label,180)) returning id into result;
 update public.questions set answer_count=answer_count+1 where id=question;
 perform internal.notify(owner_id,'community','Your question has a new answer','/communities?tab=Questions');
 return result;
end $$;
revoke all on function public.add_answer(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.add_answer(uuid,text,text,text) to authenticated;

create function internal.file_referenced(bucket text,object_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select case bucket
  when 'study-attachments' then exists(select 1 from public.message_attachments where path=object_path)
  when 'study-resources' then exists(select 1 from public.resources where path=object_path)
  when 'study-question-files' then exists(select 1 from public.questions where attachment_path=object_path) or exists(select 1 from public.answers where attachment_path=object_path)
  else true end;
$$;
revoke all on function internal.file_referenced(text,text) from public,anon,authenticated;
grant execute on function internal.file_referenced(text,text) to authenticated;
drop policy edu_orphan_delete on storage.objects;
create policy edu_orphan_delete on storage.objects for delete to authenticated using(owner_id=auth.uid()::text and not internal.file_referenced(bucket_id,name));

-- Staff can claim queued work after opening a report. Keeping snapshots small
-- ensures there is no conversation-wide administrative read surface.
create function public.claim_report(ticket uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not internal.staff() then raise exception 'Moderator access required';end if;
 update public.moderation_cases set assigned_to=auth.uid() where report_id=ticket and status='open' and (assigned_to is null or assigned_to=auth.uid());
 if not found then raise exception 'This case is closed or already assigned';end if;
 insert into public.audit_logs(actor_id,action,reference) values(auth.uid(),'Claimed report',ticket::text);
end $$;
revoke all on function public.claim_report(uuid) from public,anon,authenticated;
grant execute on function public.claim_report(uuid) to authenticated;
