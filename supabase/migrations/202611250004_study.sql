create table public.study_groups(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles on delete cascade,subject_id text not null references public.subjects,name text not null,description text not null,topic text,category text not null,capacity integer not null check(capacity between 2 and 30),privacy text not null check(privacy in ('Open','Approval','Invitation')),format text not null check(format in ('Online','Local public space')),created_at timestamptz not null default now(),archived boolean not null default false);
create table public.study_group_members(group_id uuid references public.study_groups on delete cascade,user_id uuid references public.profiles on delete cascade,status text not null check(status in ('pending','active','invited')),primary key(group_id,user_id));
create table public.study_rooms(id uuid primary key references public.study_groups on delete cascade,objective text not null default '',scheduled_at timestamptz);
create table public.study_room_participants(room_id uuid references public.study_rooms on delete cascade,user_id uuid references public.profiles on delete cascade,ready boolean not null default false,ready_at timestamptz,primary key(room_id,user_id));
create table public.study_timers(id uuid primary key default gen_random_uuid(),room_id uuid not null references public.study_rooms on delete cascade,started_at timestamptz not null default now(),study_minutes integer not null check(study_minutes between 1 and 120),break_minutes integer not null check(break_minutes between 1 and 30),ended_at timestamptz);
create table public.room_tasks(id uuid primary key default gen_random_uuid(),room_id uuid not null references public.study_rooms on delete cascade,title text not null,done boolean not null default false);
create table public.room_attendance(timer_id uuid references public.study_timers on delete cascade,user_id uuid references public.profiles on delete cascade,minutes integer not null check(minutes between 0 and 120),primary key(timer_id,user_id));
create table public.group_announcements(id uuid primary key default gen_random_uuid(),group_id uuid not null references public.study_groups on delete cascade,body text not null,created_at timestamptz not null default now());
create table public.group_resources(group_id uuid references public.study_groups on delete cascade,resource_id uuid references public.resources on delete cascade,primary key(group_id,resource_id));

create function internal.group_member(team uuid) returns boolean language sql stable security definer set search_path='' as $$
 select internal.active(auth.uid()) and exists(select 1 from public.study_group_members m join public.study_groups g on g.id=m.group_id where m.group_id=team and m.user_id=auth.uid() and m.status='active' and not g.archived);
$$;
create function internal.group_owner(team uuid) returns boolean language sql stable security definer set search_path='' as $$
 select internal.active(auth.uid()) and exists(select 1 from public.study_groups where id=team and owner_id=auth.uid() and not archived);
$$;
create function public.create_group(group_name text,details text,subject text,topic_text text,kind text,max_members integer,access text,meeting_format text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); team uuid;
begin
 perform internal.limit_action('group-create',5,interval '1 day');perform internal.check_content(group_name,100);perform internal.check_content(details,1500);
 if length(coalesce(topic_text,''))>100 or kind not in ('Subject revision','Exam preparation','Assignment discussion','Project collaboration','Daily study','Weekly revision','Programming practice','Accountability') then raise exception 'Invalid group details';end if;
 insert into public.study_groups(owner_id,subject_id,name,description,topic,category,capacity,privacy,format) values(actor,subject,group_name,details,topic_text,kind,max_members,access,meeting_format) returning id into team;
 insert into public.study_group_members values(team,actor,'active');
 insert into public.study_rooms(id,objective) values(team,details);
 insert into public.conversations(id,title) values(team,group_name);
 insert into public.conversation_participants(conversation_id,user_id) values(team,actor);
 return team;
end $$;
create function public.group_membership(team uuid,decision text,member uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); g public.study_groups; person uuid:=coalesce(member,actor); current_status text;
begin
 select * into g from public.study_groups where id=team and not archived for update;
 if not found or not internal.active(person) or internal.blocked(g.owner_id,person) then raise exception 'Group unavailable';end if;
 select status into current_status from public.study_group_members where group_id=team and user_id=person;
 if decision='join' and person=actor then
  if current_status='active' then return;end if;
  if g.privacy='Invitation' and current_status is distinct from 'invited' then raise exception 'An invitation is required';end if;
  if g.privacy='Approval' and current_status is distinct from 'invited' then insert into public.study_group_members values(team,person,'pending') on conflict do nothing;return;end if;
 elsif decision='approve' and g.owner_id=actor and current_status='pending' then null;
 elsif decision='invite' and g.owner_id=actor then
  perform internal.limit_action('group-invite',8,interval '1 day');
  insert into public.study_group_members values(team,person,'invited') on conflict do nothing;
  if found then perform internal.notify(person,'groups','Invitation to a study group','/communities?tab=Groups'); end if;
  return;
 elsif decision='leave' and person<>g.owner_id and (person=actor or g.owner_id=actor) then
  delete from public.study_group_members where group_id=team and user_id=person;
  delete from public.study_room_participants where room_id=team and user_id=person;
  delete from public.conversation_participants where conversation_id=team and user_id=person;
  return;
 else raise exception 'Membership change denied' using errcode='42501';end if;
 if (select count(*) from public.study_group_members where group_id=team and status='active')>=g.capacity then raise exception 'This group is full';end if;
 insert into public.study_group_members values(team,person,'active') on conflict(group_id,user_id) do update set status='active';
 insert into public.conversation_participants(conversation_id,user_id) values(team,person) on conflict do nothing;
end $$;
create function public.room_ready(room uuid,ready_state boolean) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor();
begin
 if not internal.group_member(room) then raise exception 'Join the group first';end if;
 insert into public.study_room_participants(room_id,user_id,ready,ready_at) values(room,actor,ready_state,case when ready_state then now() end)
 on conflict(room_id,user_id) do update set ready=excluded.ready,ready_at=case when excluded.ready and public.study_room_participants.ready then public.study_room_participants.ready_at else excluded.ready_at end;
end $$;
create function public.start_timer(room uuid,study_length integer,break_length integer) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not internal.group_owner(room) then raise exception 'Only the group leader can start the timer';end if;
 perform 1 from public.study_rooms where id=room for update;
 if exists(select 1 from public.study_timers where room_id=room and ended_at is null and started_at+make_interval(mins=>study_minutes+break_minutes)>now()) then raise exception 'A timer is already running';end if;
 insert into public.study_timers(room_id,study_minutes,break_minutes) values(room,study_length,break_length) returning id into result;
 return result;
end $$;
create function public.log_room_attendance(timer uuid) returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); t public.study_timers; result integer;
begin
 select * into t from public.study_timers where id=timer;
 if not found or not internal.group_member(t.room_id) or not exists(select 1 from public.study_room_participants where room_id=t.room_id and user_id=actor and ready and ready_at<t.started_at+make_interval(mins=>t.study_minutes)) then raise exception 'Mark yourself ready before the focus interval ends';end if;
 if now()<t.started_at+make_interval(mins=>t.study_minutes) then raise exception 'The focus interval is still running';end if;
 result:=t.study_minutes;
 insert into public.room_attendance values(timer,actor,result) on conflict do nothing;
 return result;
end $$;
create function public.room_task(room uuid,task_title text default null,task_id uuid default null,completed boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if not internal.group_member(room) then raise exception 'Join the group first';end if;
 if task_id is null then
  perform internal.limit_action('room-task',20,interval '1 hour');perform internal.check_content(task_title,150);
  insert into public.room_tasks(room_id,title) values(room,task_title);
 else update public.room_tasks set done=completed where id=task_id and room_id=room;end if;
end $$;
create function public.schedule_room(room uuid,objective_text text,starts timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
 if not internal.group_owner(room) then raise exception 'Only the group leader can schedule';end if;
 perform internal.check_content(objective_text,300);
 update public.study_rooms set objective=objective_text,scheduled_at=starts where id=room;
end $$;
create function public.announce(team uuid,content text) returns void language plpgsql security definer set search_path='' as $$
declare member record;
begin
 if not internal.group_owner(team) then raise exception 'Only the leader can announce';end if;
 perform internal.limit_action('announce',10,interval '1 hour');perform internal.check_content(content,1000);
 insert into public.group_announcements(group_id,body) values(team,content);
 for member in select user_id from public.study_group_members where group_id=team and status='active' loop
  perform internal.notify(member.user_id,'groups','New group announcement','/communities?tab=Groups');
 end loop;
end $$;

create table public.study_tasks(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references public.profiles on delete cascade,subject_id text references public.subjects,title text not null check(length(title) between 1 and 140),notes text check(length(notes)<=1000),kind text not null default 'Study' check(kind in ('Study','Revision','Assignment','Session')),priority text not null default 'Normal' check(priority in ('Low','Normal','High')),due_on date,done boolean not null default false,created_at timestamptz not null default now());
create table public.study_goals(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references public.profiles on delete cascade,title text not null check(length(title) between 1 and 140),subject_id text references public.subjects,target_on date,done boolean not null default false,created_at timestamptz not null default now());
create table public.examinations(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references public.profiles on delete cascade,subject_id text references public.subjects,title text not null check(length(title) between 1 and 140),exam_on date not null,formulas text check(length(formulas)<=5000),mock_score integer check(mock_score between 0 and 100),created_at timestamptz not null default now());
create table public.exam_topics(id uuid primary key default gen_random_uuid(),exam_id uuid not null references public.examinations on delete cascade,user_id uuid not null default auth.uid() references public.profiles on delete cascade,title text not null check(length(title) between 1 and 140),done boolean not null default false);
create table public.focus_logs(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references public.profiles on delete cascade,subject_id text references public.subjects,minutes integer not null check(minutes between 1 and 120),created_at timestamptz not null default now());

create table public.flashcard_decks(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references public.profiles on delete cascade,subject_id text references public.subjects,community_id text references public.communities on delete set null,title text not null check(length(title) between 1 and 100),created_at timestamptz not null default now());
create table public.flashcards(id uuid primary key default gen_random_uuid(),deck_id uuid not null references public.flashcard_decks on delete cascade,front text not null check(length(front) between 1 and 1000),back text not null check(length(back) between 1 and 3000));
create table public.flashcard_reviews(id uuid primary key default gen_random_uuid(),card_id uuid not null references public.flashcards on delete cascade,user_id uuid not null references public.profiles on delete cascade,difficulty text not null check(difficulty in ('Easy','Medium','Difficult')),reviewed_at timestamptz not null default now(),next_review_at timestamptz not null);
create function internal.deck_owner(deck uuid) returns boolean language sql stable security definer set search_path='' as $$
 select internal.active(auth.uid()) and exists(select 1 from public.flashcard_decks where id=deck and user_id=auth.uid());
$$;
create function public.review_card(card uuid,rating text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); wait_days int;
begin
 if not exists(select 1 from public.flashcards f join public.flashcard_decks d on d.id=f.deck_id where f.id=card and (d.user_id=actor or internal.community_member(d.community_id))) then raise exception 'Card unavailable';end if;
 perform internal.limit_action('flashcards',80,interval '1 hour');
 wait_days:=case rating when 'Easy' then 7 when 'Medium' then 3 when 'Difficult' then 1 end;
 if wait_days is null then raise exception 'Select a valid difficulty';end if;
 insert into public.flashcard_reviews(card_id,user_id,difficulty,next_review_at) values(card,actor,rating,now()+make_interval(days=>wait_days));
end $$;

create table public.quizzes(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references public.profiles on delete cascade,subject_id text references public.subjects,community_id text references public.communities on delete set null,title text not null check(length(title) between 1 and 100),created_at timestamptz not null default now());
create table public.quiz_questions(id uuid primary key default gen_random_uuid(),quiz_id uuid not null references public.quizzes on delete cascade,prompt text not null,options text[] not null,position integer not null,unique(quiz_id,position));
create table internal.quiz_keys(question_id uuid primary key references public.quiz_questions on delete cascade,correct_index integer not null check(correct_index between 0 and 3),explanation text not null);
create table public.quiz_attempts(id uuid primary key default gen_random_uuid(),quiz_id uuid not null references public.quizzes on delete cascade,user_id uuid not null references public.profiles on delete cascade,score integer not null,total integer not null,results jsonb not null,created_at timestamptz not null default now());
create function public.add_quiz_item(quiz uuid,prompt_text text,choices text[],correct integer,explanation_text text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); item uuid; p integer;
begin
 perform 1 from public.quizzes where id=quiz and user_id=actor for update;
 if not found then raise exception 'Only the quiz author can add questions';end if;
 perform internal.check_content(prompt_text,2000);perform internal.check_content(explanation_text,3000);
 if cardinality(choices)<>4 or correct not between 0 and 3 or exists(select 1 from unnest(choices) x where x is null or length(btrim(x)) not between 1 and 300) then raise exception 'Enter four valid options and a correct answer';end if;
 select coalesce(max(position),0)+1 into p from public.quiz_questions where quiz_id=quiz;
 if p>40 then raise exception 'The quiz has reached 40 questions';end if;
 insert into public.quiz_questions(quiz_id,prompt,options,position) values(quiz,prompt_text,choices,p) returning id into item;
 insert into internal.quiz_keys values(item,correct,explanation_text);
end $$;
create function public.grade_quiz(quiz uuid,selections jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); attempt uuid; points integer; total_items integer; report jsonb;
begin
 if not exists(select 1 from public.quizzes q where q.id=quiz and (q.user_id=actor or internal.community_member(q.community_id))) then raise exception 'Quiz unavailable';end if;
 perform internal.limit_action('quiz-attempt',15,interval '1 hour');
 if jsonb_typeof(selections)<>'object' or length(selections::text)>6000 then raise exception 'Invalid answers';end if;
 if exists(select 1 from public.quiz_questions q where q.quiz_id=quiz and coalesce(selections->>q.id::text,'') !~ '^[0-3]$') then raise exception 'Answer all questions first';end if;
 select count(*),count(*) filter(where (selections->>q.id::text)::int=k.correct_index),jsonb_agg(jsonb_build_object('prompt',q.prompt,'chosen',q.options[(selections->>q.id::text)::int+1],'correct',q.options[k.correct_index+1],'explanation',k.explanation,'ok',(selections->>q.id::text)::int=k.correct_index) order by q.position)
 into total_items,points,report from public.quiz_questions q join internal.quiz_keys k on k.question_id=q.id where q.quiz_id=quiz;
 if total_items=0 then raise exception 'Add a question first';end if;
 insert into public.quiz_attempts(quiz_id,user_id,score,total,results) values(quiz,actor,points,total_items,report) returning id into attempt;
 return attempt;
end $$;

create table public.badges(id text primary key,name text not null,description text not null);
create table public.user_badges(user_id uuid references public.profiles on delete cascade,badge_id text references public.badges on delete cascade,awarded_at timestamptz not null default now(),primary key(user_id,badge_id));
insert into public.badges values ('first','First Step','Complete a personal study task'),('helpful','Helpful Peer','Receive a helpful vote'),('study-buddy','Study Buddy','Complete a peer session'),('contributor','Community Contributor','Share a learning resource'),('consistent','Consistent Learner','Log focus time on three separate days'),('team','Team Player','Log a group focus session'),('revision','Revision Champion','Complete an exam topic');
create function public.refresh_badges() returns void language sql security definer set search_path='' as $$
 insert into public.user_badges(user_id,badge_id)
 select t.actor,b.id from (select internal.actor() actor) t cross join public.badges b where case b.id
  when 'first' then exists(select 1 from public.study_tasks where user_id=t.actor and done)
  when 'helpful' then exists(select 1 from public.answers where author_id=t.actor and helpful_count>0 and not hidden)
  when 'study-buddy' then exists(select 1 from public.session_participants p join public.study_sessions s on s.id=p.session_id where p.user_id=t.actor and s.completed_at is not null)
  when 'contributor' then exists(select 1 from public.resources where author_id=t.actor and not hidden)
  when 'consistent' then (select count(distinct created_at::date) from public.focus_logs where user_id=t.actor)>=3
  when 'team' then exists(select 1 from public.room_attendance where user_id=t.actor)
  when 'revision' then exists(select 1 from public.exam_topics where user_id=t.actor and done)
 end on conflict do nothing;
$$;

do $$ declare t text; begin
 foreach t in array array['study_groups','study_group_members','study_rooms','study_room_participants','study_timers','room_tasks','room_attendance','group_announcements','group_resources','study_tasks','study_goals','examinations','exam_topics','focus_logs','flashcard_decks','flashcards','flashcard_reviews','quizzes','quiz_questions','quiz_attempts','badges','user_badges'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['study_tasks','study_goals','examinations','focus_logs'] loop
  execute format('grant insert,update,delete on public.%I to authenticated',t);
  execute format('create policy private_data on public.%I for all to authenticated using(user_id=auth.uid() and internal.active(auth.uid())) with check(user_id=auth.uid() and internal.active(auth.uid()))',t);
 end loop;
 foreach t in array array['flashcard_reviews','quiz_attempts','user_badges','room_attendance'] loop
  execute format('create policy private_history on public.%I for select to authenticated using(user_id=auth.uid() and internal.active(auth.uid()))',t);
 end loop;
 foreach t in array array['flashcard_decks','quizzes'] loop
  execute format('grant insert,update,delete on public.%I to authenticated',t);
  execute format('create policy author_edit on public.%I for all to authenticated using(user_id=auth.uid() and internal.active(auth.uid())) with check(user_id=auth.uid() and internal.active(auth.uid()) and (community_id is null or internal.community_member(community_id)))',t);
  execute format('create policy shared_read on public.%I for select to authenticated using(internal.community_member(community_id))',t);
 end loop;
end $$;
create policy badge_catalog on public.badges for select to authenticated using(true);
grant insert,update,delete on public.flashcards,public.exam_topics to authenticated;
create policy edit_cards on public.flashcards for all to authenticated using(internal.deck_owner(deck_id)) with check(internal.deck_owner(deck_id));
create policy shared_cards on public.flashcards for select to authenticated using(exists(select 1 from public.flashcard_decks where id=deck_id));
create policy visible_quiz_items on public.quiz_questions for select to authenticated using(exists(select 1 from public.quizzes where id=quiz_id));
create policy exam_topics_private on public.exam_topics for all to authenticated using(user_id=auth.uid() and exists(select 1 from public.examinations where id=exam_id)) with check(user_id=auth.uid() and exists(select 1 from public.examinations where id=exam_id));
create policy browse_groups on public.study_groups for select to authenticated using(internal.active(auth.uid()) and not archived and (privacy<>'Invitation' or internal.group_member(id) or exists(select 1 from public.study_group_members where group_id=id and user_id=auth.uid())));
create policy group_members_read on public.study_group_members for select to authenticated using(internal.active(auth.uid()) and (user_id=auth.uid() or internal.group_owner(group_id) or (status='active' and internal.group_member(group_id))));
create policy room_read on public.study_rooms for select to authenticated using(internal.group_member(id));
create policy room_people on public.study_room_participants for select to authenticated using(internal.group_member(room_id));
create policy room_timer on public.study_timers for select to authenticated using(internal.group_member(room_id));
create policy room_tasks_read on public.room_tasks for select to authenticated using(internal.group_member(room_id));
create policy announcements_read on public.group_announcements for select to authenticated using(internal.group_member(group_id));
create policy group_resources_read on public.group_resources for select to authenticated using(internal.group_member(group_id));
grant insert,delete on public.group_resources to authenticated;
create policy group_resources_manage on public.group_resources for all to authenticated using(internal.group_owner(group_id)) with check(internal.group_owner(group_id) and exists(select 1 from public.resources where id=resource_id));
revoke execute on function internal.group_owner(uuid),internal.group_member(uuid),internal.deck_owner(uuid) from public,anon,authenticated;
grant execute on function internal.group_owner(uuid),internal.group_member(uuid),internal.deck_owner(uuid),internal.community_member(text) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.study_timers,public.study_room_participants,public.room_tasks;
 end if;
end $$;
