create table public.reports(id uuid primary key default gen_random_uuid(),reporter_id uuid references public.profiles on delete set null,target_type text not null check(target_type in ('user','message','question','answer','post','resource','review')),target_id uuid not null,category text not null,reason text not null,status text not null default 'pending' check(status in ('pending','resolved','dismissed')),created_at timestamptz not null default now());
create unique index single_open_report on public.reports(reporter_id,target_type,target_id) where status='pending';
create table internal.report_evidence(report_id uuid primary key references public.reports on delete cascade,target_user uuid references public.profiles on delete set null,content text);
create table public.moderation_cases(id uuid primary key default gen_random_uuid(),report_id uuid unique references public.reports on delete set null,assigned_to uuid references public.profiles on delete set null,status text not null default 'open',created_at timestamptz not null default now());
create table public.moderation_actions(id uuid primary key default gen_random_uuid(),case_id uuid references public.moderation_cases on delete set null,actor_id uuid references public.profiles on delete set null,user_id uuid references public.profiles on delete set null,action text not null,note text not null,created_at timestamptz not null default now());
create table public.audit_logs(id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles on delete set null,action text not null,reference text,created_at timestamptz not null default now());
create table public.moderation_appeals(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,action_id uuid not null unique references public.moderation_actions on delete cascade,body text not null,status text not null default 'pending' check(status in ('pending','upheld','overturned')),created_at timestamptz not null default now());
create table public.verification_requests(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,institution_id text not null references public.institutions,status text not null default 'pending' check(status in ('pending','verified','declined')),created_at timestamptz not null default now(),unique(user_id,institution_id));
create table public.app_settings(key text primary key,value text not null);

create function public.report_content(kind text,item uuid,classification text,details text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); subject uuid; evidence text; ticket uuid;
begin
 perform internal.limit_action('report',8,interval '1 day');perform internal.check_content(details,2000,true);
 if classification not in ('Harassment','Unwanted contact','Spam or fraud','Academic integrity','Discrimination','Unsafe content','Location or privacy misuse','Other') then raise exception 'Choose a report category';end if;
 case kind
 when 'user' then select id,alias into subject,evidence from public.profiles where id=item and id<>actor;
 when 'message' then select author_id,body into subject,evidence from public.messages where id=item and not hidden and internal.chat_member(conversation_id);
 when 'question' then select o.user_id,q.title||E'\n'||q.body into subject,evidence from public.questions q left join internal.question_owners o on o.question_id=q.id where q.id=item and not q.hidden;
 when 'answer' then select a.author_id,a.body into subject,evidence from public.answers a join public.questions q on q.id=a.question_id where a.id=item and not a.hidden and not q.hidden;
 when 'post' then select author_id,title||E'\n'||body into subject,evidence from public.community_posts where id=item and not hidden;
 when 'resource' then select author_id,title||E'\n'||description into subject,evidence from public.resources where id=item and not hidden;
 when 'review' then select reviewer_id,coalesce(feedback,'Review rating') into subject,evidence from public.reviews where id=item and recipient_id=actor and not hidden;
 else raise exception 'Unsupported report type';
 end case;
 if not found or subject=actor then raise exception 'This content cannot be reported';end if;
 insert into public.reports(reporter_id,target_type,target_id,category,reason) values(actor,kind,item,classification,details) returning id into ticket;
 insert into internal.report_evidence values(ticket,subject,evidence);
 insert into public.moderation_cases(report_id) values(ticket);
 return ticket;
end $$;
create function public.inspect_report(ticket uuid) returns table(content text) language plpgsql security definer set search_path='' as $$
begin
 if not internal.staff() then raise exception 'Moderator access required' using errcode='42501';end if;
 insert into public.audit_logs(actor_id,action,reference) values(auth.uid(),'Read reported item',ticket::text);
 return query select e.content from internal.report_evidence e where e.report_id=ticket;
end $$;
create function public.resolve_report(ticket uuid,decision text,explanation text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); r public.reports; person uuid; moderation_case uuid;
begin
 if not internal.staff() then raise exception 'Moderator access required' using errcode='42501';end if;
 if decision not in ('dismiss','hide','warn','suspend','ban') or (decision='ban' and not internal.staff(true)) then raise exception 'This action requires additional authority';end if;
 perform internal.check_content(explanation,1000);
 select * into r from public.reports where id=ticket and status='pending' for update;
 if not found then raise exception 'This report has already been resolved';end if;
 if not internal.staff(true) and exists(select 1 from public.moderation_cases c where c.report_id=ticket and c.assigned_to is not null and c.assigned_to<>actor) then raise exception 'This case is assigned to another moderator';end if;
 select target_user into person from internal.report_evidence where report_id=ticket;
 if decision in ('warn','suspend','ban') and (person is null or person=actor or (not internal.staff(true) and exists(select 1 from public.user_roles where user_id=person))) then raise exception 'Account action unavailable';end if;
 if decision='hide' then
  case r.target_type
   when 'message' then update public.messages set hidden=true where id=r.target_id;
   when 'post' then update public.community_posts set hidden=true where id=r.target_id;
   when 'question' then update public.questions set hidden=true where id=r.target_id;
   when 'answer' then
    update public.answers set hidden=true where id=r.target_id and not hidden;
    if found then update public.questions q set answer_count=greatest(0,q.answer_count-1),accepted_answer_id=case when q.accepted_answer_id=r.target_id then null else q.accepted_answer_id end where q.id=(select a.question_id from public.answers a where a.id=r.target_id);end if;
   when 'resource' then update public.resources set hidden=true where id=r.target_id;
   when 'review' then update public.reviews set hidden=true where id=r.target_id;
   else raise exception 'Select an account action for a user report';
  end case;
 end if;
 if decision in ('suspend','ban') then update public.private_profiles set suspended_until=case when decision='ban' then 'infinity'::timestamptz else greatest(coalesce(suspended_until,now()),now()+interval '7 days') end where user_id=person;end if;
 update public.reports set status=case when decision='dismiss' then 'dismissed' else 'resolved' end where id=ticket;
 update public.moderation_cases set assigned_to=actor,status='closed' where report_id=ticket returning id into moderation_case;
 insert into public.moderation_actions(case_id,actor_id,user_id,action,note) values(moderation_case,actor,case when decision='dismiss' then null else person end,decision,explanation);
 insert into public.audit_logs(actor_id,action,reference) values(actor,'Resolved report ('||decision||')',ticket::text);
 perform internal.notify(r.reporter_id,'moderation','Your report was reviewed','/profile');
 if decision<>'dismiss' then perform internal.notify(person,'moderation','A moderation action affected your account or content','/profile');end if;
end $$;
create function public.appeal_action(action_id uuid,details text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.moderation_actions a where a.id=appeal_action.action_id and a.user_id=auth.uid()) then raise exception 'You may only appeal an action on your own account' using errcode='42501';end if;
 perform internal.check_content(details,2000);
 insert into public.moderation_appeals(user_id,action_id,body) values(auth.uid(),action_id,details);
end $$;
create function public.resolve_appeal(appeal uuid,decision text) returns void language plpgsql security definer set search_path='' as $$
declare a public.moderation_appeals; m public.moderation_actions; target_type text; target uuid;
begin
 if not internal.staff(true) or decision not in ('upheld','overturned') then raise exception 'Administrator access required';end if;
 select * into a from public.moderation_appeals where id=appeal and status='pending' for update;
 if not found then raise exception 'Appeal unavailable';end if;
 select * into m from public.moderation_actions where id=a.action_id;
 if m.actor_id=auth.uid() then raise exception 'Another administrator must review this appeal';end if;
 update public.moderation_appeals set status=decision where id=appeal;
 if decision='overturned' and m.action in ('suspend','ban') and not exists(select 1 from public.moderation_actions x left join public.moderation_appeals p on p.action_id=x.id where x.id<>m.id and x.user_id=a.user_id and coalesce(p.status,'')<>'overturned' and (x.action='ban' or (x.action='suspend' and x.created_at>now()-interval '7 days'))) then
  update public.private_profiles set suspended_until=null where user_id=a.user_id;
 elsif decision='overturned' and m.action='hide' then
  select r.target_type,r.target_id into target_type,target from public.moderation_cases c join public.reports r on r.id=c.report_id where c.id=m.case_id;
  case target_type
  when 'message' then update public.messages set hidden=false where id=target;
  when 'question' then update public.questions set hidden=false where id=target;
  when 'answer' then
    update public.answers set hidden=false where id=target and hidden;
    if found then update public.questions set answer_count=answer_count+1 where id=(select question_id from public.answers where id=target);end if;
  when 'post' then update public.community_posts set hidden=false where id=target;
  when 'resource' then update public.resources set hidden=false where id=target;
  when 'review' then update public.reviews set hidden=false where id=target;
  else null;
  end case;
 end if;
 insert into public.audit_logs(actor_id,action,reference) values(auth.uid(),'Appeal '||decision,appeal::text);
 perform internal.notify(a.user_id,'moderation','Your appeal was reviewed','/profile');
end $$;
create function public.request_verification() returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); inst text;
begin
 select p.institution_id into inst from public.profiles p join public.institutions i on i.id=p.institution_id join auth.users u on u.id=p.id where p.id=actor and u.email_confirmed_at is not null and lower(split_part(u.email,'@',2))=lower(i.email_domain);
 if inst is null then raise exception 'Your verified email must match the institution domain';end if;
 insert into public.verification_requests(user_id,institution_id) values(actor,inst) on conflict(user_id,institution_id) do update set status='pending',created_at=now() where public.verification_requests.status<>'pending' and not exists(select 1 from public.private_profiles where user_id=actor and institution_verified);
end $$;
create function public.admin_action(kind text,item text,action text,payload jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
declare verification public.verification_requests;
begin
 if not (internal.staff(true) or (kind='post' and internal.staff())) then raise exception 'Administrator access required' using errcode='42501';end if;
 case kind
 when 'role' then
  if item::uuid=auth.uid() then raise exception 'A second administrator must change your role';end if;
  if action='grant' then insert into public.user_roles values(item::uuid,'moderator') on conflict do nothing;
  elsif action='revoke' then delete from public.user_roles where user_id=item::uuid and role='moderator';
  else raise exception 'Invalid role action';end if;
 when 'user' then
  if item::uuid=auth.uid() or action not in ('restore','warn','suspend','ban') or exists(select 1 from public.user_roles where user_id=item::uuid and role='admin') then raise exception 'Account action unavailable';end if;
  if action<>'warn' then update public.private_profiles set suspended_until=case action when 'ban' then 'infinity'::timestamptz when 'suspend' then now()+interval '7 days' else null end where user_id=item::uuid;end if;
  insert into public.moderation_actions(actor_id,user_id,action,note) values(auth.uid(),item::uuid,action,left(coalesce(nullif(payload->>'note',''),'Administrator account action'),1000));
 when 'subject' then
  perform internal.check_content(payload->>'name',100);
  insert into public.subjects values(item,payload->>'name') on conflict(id) do update set name=excluded.name;
 when 'institution' then
  perform internal.check_content(payload->>'name',120);
  if (payload->>'domain') is not null and (payload->>'domain') !~ '^[a-zA-Z0-9.-]+[.][a-zA-Z]{2,}$' then raise exception 'Invalid email domain';end if;
  insert into public.institutions values(item,payload->>'name',payload->>'domain') on conflict(id) do update set name=excluded.name,email_domain=excluded.email_domain;
 when 'community' then
  if action in ('archive','restore') then update public.communities set archived=action='archive' where id=item;
  else
   perform internal.check_content(payload->>'name',100);perform internal.check_content(payload->>'description',400);
   insert into public.communities(id,name,description,category,subject_id) values(item,payload->>'name',payload->>'description',coalesce(payload->>'category','Subject'),payload->>'subject_id') on conflict(id) do update set name=excluded.name,description=excluded.description,category=excluded.category,subject_id=excluded.subject_id;
   insert into public.community_channels(community_id,name) values(item,'General') on conflict do nothing;
  end if;
 when 'group' then
  if action not in ('archive','restore') then raise exception 'Invalid action';end if;
  update public.study_groups set archived=action='archive' where id=item::uuid;
 when 'post' then
  if action not in ('pin','unpin') then raise exception 'Invalid post action';end if;
  update public.community_posts set pinned=action='pin' where id=item::uuid;
 when 'verification' then
  if action not in ('verified','declined') then raise exception 'Invalid verification decision';end if;
  update public.verification_requests set status=action where id=item::uuid and status='pending' returning * into verification;
  if action='verified' and found then
   update public.private_profiles p set institution_verified=true from public.profiles a,public.institutions i,auth.users u where p.user_id=verification.user_id and a.id=p.user_id and a.institution_id=verification.institution_id and i.id=a.institution_id and u.id=a.id and u.email_confirmed_at is not null and lower(split_part(u.email,'@',2))=lower(i.email_domain);
   if not found then raise exception 'The account no longer matches the institution';end if;
  end if;
 when 'settings' then
  perform internal.check_content(payload->>'value',500);
  if item not in ('announcement','guidelines_summary') then raise exception 'Invalid setting';end if;
  insert into public.app_settings values(item,payload->>'value') on conflict(key) do update set value=excluded.value;
 else raise exception 'Unsupported action';
 end case;
 insert into public.audit_logs(actor_id,action,reference) values(auth.uid(),kind||' '||action,item);
end $$;
create function public.admin_directory() returns table(id uuid,alias text,role text,joined timestamptz,restricted boolean) language plpgsql stable security definer set search_path='' as $$
begin
 if not internal.staff(true) then raise exception 'Administrator access required' using errcode='42501';end if;
 return query select p.id,p.alias,coalesce((select ur.role from public.user_roles ur where ur.user_id=p.id order by ur.role limit 1),'student'),p.created_at,coalesce(pr.suspended_until>now(),false) from public.profiles p join public.private_profiles pr on pr.user_id=p.id order by p.created_at desc limit 250;
end $$;
create function public.admin_metrics() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not internal.staff(true) then raise exception 'Administrator access required' using errcode='42501';end if;
 return jsonb_build_object('Registered students',(select count(*) from public.profiles),'Active in 7 days',(select count(*) from auth.users where last_sign_in_at>now()-interval '7 days'),'Completed sessions',(select count(*) from public.study_sessions where completed_at is not null),'Successful matches',(select count(*) from public.study_requests where status='accepted'),'Questions',(select count(*) from public.questions where not hidden),'Answers',(select count(*) from public.answers where not hidden),'Active communities',(select count(distinct c.id) from public.communities c join public.community_members m on m.community_id=c.id where not archived),'Resources',(select count(*) from public.resources where not hidden),'Pending reports',(select count(*) from public.reports where status='pending'),
 'subjects',(select coalesce(jsonb_agg(x),'[]') from (select s.name,count(*) value from public.questions q join public.subjects s on s.id=q.subject_id where not q.hidden group by s.name order by value desc limit 10)x),
 'regions',(select coalesce(jsonb_agg(x),'[]') from (select r.name,count(*) value from public.private_profiles p join public.geographic_regions r on r.id=internal.region_for(p.region_id,'city') where p.location_opt_in group by r.name having count(*)>=5 order by value desc limit 10)x));
end $$;
create function public.admin_catalog() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not internal.staff(true) then raise exception 'Administrator access required' using errcode='42501';end if;
 return jsonb_build_object('communities',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'archived',archived)),'[]') from public.communities),
 'groups',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'archived',archived)),'[]') from public.study_groups));
end $$;

do $$ declare t text; begin
 foreach t in array array['reports','moderation_cases','moderation_actions','audit_logs','moderation_appeals','verification_requests','app_settings'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  if t<>'app_settings' then execute format('create policy staff_read on public.%I for select to authenticated using(internal.staff(%L))',t,t='verification_requests');end if;
 end loop;
end $$;
create policy own_reports on public.reports for select to authenticated using(reporter_id=auth.uid());
create policy own_appeals on public.moderation_appeals for select to authenticated using(user_id=auth.uid());
create policy own_actions on public.moderation_actions for select to authenticated using(user_id=auth.uid());
create policy own_verification on public.verification_requests for select to authenticated using(user_id=auth.uid());
create policy app_settings_read on public.app_settings for select to authenticated using(internal.active(auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('study-attachments','study-attachments',false,8388608,array['application/pdf','image/png','image/jpeg','text/plain']),
 ('study-resources','study-resources',false,8388608,array['application/pdf','image/png','image/jpeg','text/plain']),
 ('study-question-files','study-question-files',false,8388608,array['application/pdf','image/png','image/jpeg','text/plain'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create function internal.storage_chat(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.conversations where id::text=split_part(path,'/',1) and internal.chat_member(id));
$$;
grant execute on function internal.storage_chat(text) to authenticated;
revoke execute on function internal.storage_chat(text) from public,anon;
create policy edu_upload on storage.objects for insert to authenticated with check(internal.active(auth.uid()) and name ~* '[.](pdf|jpg|jpeg|png|txt)$' and (
 (bucket_id='study-attachments' and split_part(name,'/',2)=auth.uid()::text and internal.storage_chat(name)) or
 (bucket_id='study-resources' and split_part(name,'/',1)=auth.uid()::text) or
 (bucket_id='study-question-files' and name ~ '^questions/[0-9a-f-]{36}[.][a-z]+$')
));
create policy edu_read on storage.objects for select to authenticated using(internal.active(auth.uid()) and (
 (bucket_id='study-attachments' and exists(select 1 from public.message_attachments where path=name)) or
 (bucket_id='study-resources' and exists(select 1 from public.resources where path=name))
));
create policy edu_owner_read on storage.objects for select to authenticated using(bucket_id in ('study-attachments','study-resources','study-question-files') and owner_id=auth.uid()::text);
create policy edu_orphan_delete on storage.objects for delete to authenticated using(owner_id=auth.uid()::text and (
 (bucket_id='study-attachments' and not exists(select 1 from public.message_attachments where path=name)) or
 (bucket_id='study-resources' and not exists(select 1 from public.resources where path=name)) or
 (bucket_id='study-question-files' and not exists(select 1 from public.questions where attachment_path=name))
));

create function public.my_analytics() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=internal.actor();
begin
 return jsonb_build_object(
 'sessions',(select count(*) from public.session_participants p join public.study_sessions s on s.id=p.session_id where p.user_id=actor and s.completed_at is not null),
 'questions',(select count(*) from internal.question_owners where user_id=actor),
 'answers',(select count(*) from public.answers where author_id=actor and not hidden),
 'goals',(select count(*) from public.study_goals where user_id=actor and done),
 'flashcards',(select count(distinct card_id) from public.flashcard_reviews where user_id=actor),
 'activity',(select coalesce(jsonb_agg(x),'[]') from (
 select activity_date::text as "day",subject_id,sum(minutes) as minutes from (
  select created_at::date as activity_date,subject_id,minutes from public.focus_logs where user_id=actor
  union all select s.completed_at::date,s.subject_id,s.minutes from public.study_sessions s join public.session_participants p on p.session_id=s.id where p.user_id=actor and s.completed_at is not null
  union all select (t.started_at+make_interval(mins=>t.study_minutes))::date,g.subject_id,a.minutes from public.room_attendance a join public.study_timers t on t.id=a.timer_id join public.study_groups g on g.id=t.room_id where a.user_id=actor
 ) y group by activity_date,subject_id order by activity_date)x)
 );
end $$;
create function public.my_data_export() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb:='{}'; data jsonb; t text; owner_column text;
begin
 if actor is null then raise exception 'Sign in first';end if;
 foreach t in array array['profiles','private_profiles','student_subjects','student_preferences','student_availability','user_consents','study_tasks','study_goals','examinations','exam_topics','focus_logs','flashcard_decks','flashcard_reviews','quizzes','quiz_attempts','notifications','blocked_users','conversation_participants','moderation_actions','moderation_appeals','verification_requests'] loop
  owner_column:=case t when 'profiles' then 'id' when 'blocked_users' then 'owner_id' else 'user_id' end;
  execute format('select coalesce(jsonb_agg(z),''[]'') from public.%I z where %I=$1',t,owner_column) into data using actor;
  result:=result||jsonb_build_object(t,data);
 end loop;
 return result||jsonb_build_object('messages',(select coalesce(jsonb_agg(m),'[]') from public.messages m where author_id=actor),
 'study_requests',(select coalesce(jsonb_agg(r),'[]') from public.study_requests r where actor in(r.sender_id,r.recipient_id)),
 'questions',(select coalesce(jsonb_agg(q),'[]') from public.questions q where q.id in(select public.my_questions()) and internal.active(actor)),
 'answers',(select coalesce(jsonb_agg(a),'[]') from public.answers a where a.author_id=actor));
end $$;

create function internal.refresh_verification() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.institution_id is distinct from old.institution_id then update public.private_profiles set institution_verified=false where user_id=new.id;end if;
 return new;
end $$;
create trigger profile_verification_changed after update of institution_id on public.profiles for each row execute function internal.refresh_verification();
create function internal.refresh_email_verification() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.email is distinct from old.email then update public.private_profiles set institution_verified=false where user_id=new.id;end if;
 return new;
end $$;
create trigger email_verification_changed after update of email on auth.users for each row execute function internal.refresh_email_verification();

-- Remove default execute rights across the API, then re-grant only declared application endpoints.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (
 'my_role','person','set_location','find_partners','send_request','respond_request','complete_session','submit_review','my_review_summary','send_message','update_partnership',
 'post_question','my_questions','add_answer','accept_answer','toggle_helpful','publish_post','add_comment','vote_poll','poll_results','publish_resource','resource_helpful',
 'create_group','group_membership','room_ready','start_timer','log_room_attendance','room_task','schedule_room','announce','review_card','add_quiz_item','grade_quiz','refresh_badges',
 'report_content','inspect_report','resolve_report','appeal_action','resolve_appeal','request_verification','admin_action','admin_directory','admin_metrics','admin_catalog','my_analytics','my_data_export') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
revoke execute on function internal.refresh_verification(),internal.refresh_email_verification() from public,anon,authenticated;
