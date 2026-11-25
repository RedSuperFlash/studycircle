create table public.communities(id text primary key,name text not null,description text not null,category text not null default 'Subject',subject_id text references public.subjects,archived boolean not null default false);
create table public.community_members(community_id text references public.communities on delete cascade,user_id uuid references public.profiles on delete cascade,joined_at timestamptz not null default now(),primary key(community_id,user_id));
create table public.community_channels(id uuid primary key default gen_random_uuid(),community_id text references public.communities on delete cascade,name text not null,unique(community_id,name));
create table public.community_posts(id uuid primary key default gen_random_uuid(),community_id text not null references public.communities on delete cascade,channel_id uuid references public.community_channels on delete set null,author_id uuid references public.profiles on delete set null,title text not null,body text not null,pinned boolean not null default false,poll_options text[],hidden boolean not null default false,created_at timestamptz not null default now());
create table public.community_comments(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.community_posts on delete cascade,author_id uuid references public.profiles on delete set null,body text not null,reply_to uuid references public.community_comments on delete cascade,created_at timestamptz not null default now());
create table public.poll_votes(post_id uuid references public.community_posts on delete cascade,user_id uuid references public.profiles on delete cascade,choice integer not null,primary key(post_id,user_id));
create table public.questions(id uuid primary key default gen_random_uuid(),author_id uuid references public.profiles on delete set null,community_id text references public.communities on delete set null,subject_id text not null references public.subjects,education_id text references public.education_levels,topic text,title text not null,body text not null,attachment_path text unique,attachment_label text,answer_count integer not null default 0,accepted_answer_id uuid,hidden boolean not null default false,created_at timestamptz not null default now());
create index question_subject_recent on public.questions(subject_id,created_at desc);
create table internal.question_owners(question_id uuid primary key references public.questions on delete cascade,user_id uuid not null references public.profiles on delete cascade);
create table public.answers(id uuid primary key default gen_random_uuid(),question_id uuid not null references public.questions on delete cascade,author_id uuid references public.profiles on delete set null,body text not null,helpful_count integer not null default 0,hidden boolean not null default false,created_at timestamptz not null default now());
alter table public.questions add foreign key(accepted_answer_id) references public.answers on delete set null;
create index answers_question on public.answers(question_id,created_at);
create table public.answer_reactions(answer_id uuid references public.answers on delete cascade,user_id uuid references public.profiles on delete cascade,primary key(answer_id,user_id));
create table public.answer_comments(id uuid primary key default gen_random_uuid(),answer_id uuid not null references public.answers on delete cascade,author_id uuid references public.profiles on delete set null,body text not null,created_at timestamptz not null default now());
create table public.question_bookmarks(question_id uuid references public.questions on delete cascade,user_id uuid references public.profiles on delete cascade,primary key(question_id,user_id));
create table public.post_bookmarks(post_id uuid references public.community_posts on delete cascade,user_id uuid references public.profiles on delete cascade,primary key(post_id,user_id));

create function internal.community_member(community text) returns boolean language sql stable security definer set search_path='' as $$
 select internal.active(auth.uid()) and exists(select 1 from public.community_members m join public.communities c on c.id=m.community_id where m.user_id=auth.uid() and m.community_id=community and not c.archived);
$$;
create function public.post_question(title_text text, body_text text, subject text, topic_text text default null, level text default null, anonymous boolean default true, community text default null, file_path text default null, file_label text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); result uuid;
begin
 perform internal.limit_action('question',8,interval '1 hour');
 perform internal.check_content(title_text,160);
 perform internal.check_content(body_text,7000);
 if length(coalesce(topic_text,''))>100 then raise exception 'Topic is too long';end if;
 if community is not null and not internal.community_member(community) then raise exception 'Join this community first';end if;
 if exists(select 1 from public.questions where subject_id=subject and not hidden and lower(btrim(title))=lower(btrim(title_text))) then raise exception 'A question with this title already exists. Search existing discussions first.';end if;
 if file_path is not null and (file_path !~ '^questions/[0-9a-f-]{36}[.][a-z]+$' or not exists(select 1 from storage.objects where bucket_id='study-question-files' and name=file_path and owner_id=actor::text)) then raise exception 'Invalid attachment';end if;
 insert into public.questions(author_id,community_id,subject_id,topic,education_id,title,body,attachment_path,attachment_label)
 values(case when anonymous then null else actor end,community,subject,nullif(topic_text,''),level,btrim(title_text),body_text,file_path,case when anonymous then 'Question attachment' else left(file_label,180) end) returning id into result;
 insert into internal.question_owners values(result,actor);
 return result;
end $$;
create function public.my_questions() returns setof uuid language sql stable security definer set search_path='' as $$
 select question_id from internal.question_owners where user_id=internal.actor();
$$;
create function public.add_answer(question uuid,content text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); owner_id uuid; result uuid;
begin
 perform internal.limit_action('answer',15,interval '1 hour');
 perform internal.check_content(content,7000);
 select o.user_id into owner_id from public.questions q left join internal.question_owners o on q.id=o.question_id where q.id=question and not q.hidden for update of q;
 if not found or internal.blocked(actor,owner_id) then raise exception 'Question unavailable';end if;
 insert into public.answers(question_id,author_id,body) values(question,actor,content) returning id into result;
 update public.questions set answer_count=answer_count+1 where id=question;
 perform internal.notify(owner_id,'community','Your question has a new answer','/communities?tab=Questions');
 return result;
end $$;
create function public.accept_answer(question uuid, answer uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from internal.question_owners where question_id=question and user_id=internal.actor()) then raise exception 'Only the question author can accept an answer';end if;
 if not exists(select 1 from public.answers where id=answer and question_id=question and not hidden) then raise exception 'Answer unavailable';end if;
 update public.questions set accepted_answer_id=answer where id=question and not hidden;
end $$;
create function public.toggle_helpful(answer uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); author uuid;
begin
 perform internal.limit_action('reaction',40,interval '1 hour');
 select a.author_id into author from public.answers a join public.questions q on q.id=a.question_id where a.id=answer and not a.hidden and not q.hidden and not internal.blocked(actor,a.author_id) for update of a;
 if not found or author=actor then raise exception 'This answer cannot receive your vote';end if;
 delete from public.answer_reactions where answer_id=answer and user_id=actor;
 if found then update public.answers set helpful_count=helpful_count-1 where id=answer;
 else
   insert into public.answer_reactions values(answer,actor);
   update public.answers set helpful_count=helpful_count+1 where id=answer;
   perform internal.notify(author,'community','A student found your answer helpful','/communities?tab=Questions');
 end if;
end $$;
create function public.publish_post(community text,title_text text,body_text text,channel uuid default null,options text[] default null) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); result uuid;
begin
 if not internal.community_member(community) then raise exception 'Join this community first'; end if;
 if channel is not null and not exists(select 1 from public.community_channels where id=channel and community_id=community) then raise exception 'Channel unavailable';end if;
 perform internal.limit_action('post',10,interval '1 hour');
 perform internal.check_content(title_text,160); perform internal.check_content(body_text,5000);
 if options is not null and (cardinality(options) not between 2 and 6 or exists(select 1 from unnest(options) x where x is null or length(btrim(x)) not between 1 and 80)) then raise exception 'Use 2–6 short poll options';end if;
 insert into public.community_posts(community_id,channel_id,author_id,title,body,poll_options) values(community,channel,actor,title_text,body_text,options) returning id into result;
 return result;
end $$;
create function public.add_comment(kind text,target uuid,content text,parent uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); owner_id uuid; community text;
begin
 perform internal.limit_action('comment',20,interval '1 hour');perform internal.check_content(content,2000);
 if kind='post' then
  select author_id,community_id into owner_id,community from public.community_posts where id=target and not hidden;
  if not found or not internal.community_member(community) or internal.blocked(actor,owner_id) then raise exception 'Discussion unavailable';end if;
  if parent is not null and not exists(select 1 from public.community_comments where id=parent and post_id=target) then raise exception 'Reply unavailable';end if;
  insert into public.community_comments(post_id,author_id,body,reply_to) values(target,actor,content,parent);
 elsif kind='answer' then
  select a.author_id into owner_id from public.answers a join public.questions q on q.id=a.question_id where a.id=target and not a.hidden and not q.hidden;
  if not found or internal.blocked(actor,owner_id) then raise exception 'Answer unavailable';end if;
  insert into public.answer_comments(answer_id,author_id,body) values(target,actor,content);
 else raise exception 'Invalid comment type'; end if;
 perform internal.notify(owner_id,'community','New reply to your contribution','/communities');
end $$;
create function public.vote_poll(post uuid,option_number integer) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor();
begin
 if not exists(select 1 from public.community_posts where id=post and not hidden and internal.community_member(community_id) and option_number between 1 and cardinality(poll_options)) then raise exception 'Poll unavailable';end if;
 insert into public.poll_votes values(post,actor,option_number) on conflict(post_id,user_id) do update set choice=excluded.choice;
end $$;
create function public.poll_results(post uuid) returns table(choice integer,votes bigint) language sql stable security definer set search_path='' as $$
 select v.choice,count(*) from public.poll_votes v join public.community_posts p on p.id=v.post_id where p.id=post and not p.hidden and internal.community_member(p.community_id) group by v.choice;
$$;

create table public.resources(id uuid primary key default gen_random_uuid(),author_id uuid references public.profiles on delete set null,subject_id text not null references public.subjects,topic text,education_id text references public.education_levels,course_id text references public.courses,institution_id text references public.institutions,exam text,category text not null,title text not null,description text not null,path text unique,url text,license_confirmed boolean not null check(license_confirmed),hidden boolean not null default false,created_at timestamptz not null default now(),check((path is null)<>(url is null)));
create table public.resource_bookmarks(resource_id uuid references public.resources on delete cascade,user_id uuid references public.profiles on delete cascade,primary key(resource_id,user_id));
create table public.resource_reactions(resource_id uuid references public.resources on delete cascade,user_id uuid references public.profiles on delete cascade,primary key(resource_id,user_id));
create function public.publish_resource(title_text text,details text,subject text,kind text,permission boolean,object_path text default null,external_url text default null,topic_text text default null,level text default null,course text default null,institution text default null,exam_text text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.actor(); result uuid;
begin
 perform internal.limit_action('resource',10,interval '1 hour');
 perform internal.check_content(title_text,140); perform internal.check_content(details,3000);
 if not coalesce(permission,false) then raise exception 'Confirm you have permission to share';end if;
 if kind not in ('Lecture notes','Revision notes','Formula sheet','Practice questions','Study guide','Diagram','Learning link','Flashcards') then raise exception 'Invalid resource category';end if;
 if length(coalesce(topic_text,''))>100 or length(coalesce(exam_text,''))>120 then raise exception 'Topic or examination name is too long';end if;
 if object_path is not null and (object_path not like actor::text||'/%' or not exists(select 1 from storage.objects where bucket_id='study-resources' and name=object_path)) then raise exception 'Invalid resource file';end if;
 if external_url is not null and (external_url !~ '^https://[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?[.][a-zA-Z]{2,}([/?#][^[:space:]]*)?$' or length(external_url)>500) then raise exception 'Enter a valid HTTPS learning link';end if;
 insert into public.resources(author_id,subject_id,topic,education_id,course_id,institution_id,exam,category,title,description,path,url,license_confirmed) values(actor,subject,topic_text,level,course,institution,exam_text,kind,title_text,details,object_path,external_url,true) returning id into result;
 return result;
end $$;
create function public.resource_helpful(resource uuid) returns bigint language sql stable security definer set search_path='' as $$
 select count(*) from public.resource_reactions v join public.resources r on r.id=v.resource_id
 where r.id=resource and not r.hidden and internal.active(auth.uid()) and not internal.blocked(auth.uid(),r.author_id);
$$;

do $$ declare t text; begin
 foreach t in array array['communities','community_members','community_channels','community_posts','community_comments','poll_votes','questions','answers','answer_reactions','answer_comments','question_bookmarks','post_bookmarks','resources','resource_bookmarks','resource_reactions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['community_members','question_bookmarks','post_bookmarks','resource_bookmarks','resource_reactions'] loop
  execute format('grant insert,delete on public.%I to authenticated',t);
  execute format('create policy add_own on public.%I for insert to authenticated with check(user_id=auth.uid() and internal.active(auth.uid()))',t);
  execute format('create policy remove_own on public.%I for delete to authenticated using(user_id=auth.uid())',t);
 end loop;
 foreach t in array array['community_members','poll_votes','answer_reactions','question_bookmarks','post_bookmarks','resource_bookmarks','resource_reactions'] loop
  execute format('create policy own on public.%I for select to authenticated using(user_id=auth.uid())',t);
 end loop;
end $$;
create policy visible_communities on public.communities for select to authenticated using(internal.active(auth.uid()) and not archived);
create policy visible_channels on public.community_channels for select to authenticated using(exists(select 1 from public.communities where id=community_id));
create policy visible_posts on public.community_posts for select to authenticated using(not hidden and not internal.blocked(auth.uid(),author_id) and exists(select 1 from public.communities where id=community_id));
create policy visible_comments on public.community_comments for select to authenticated using(not internal.blocked(auth.uid(),author_id) and exists(select 1 from public.community_posts where id=post_id));
create policy visible_questions on public.questions for select to authenticated using(internal.active(auth.uid()) and not hidden and not internal.blocked(auth.uid(),author_id));
create policy visible_answers on public.answers for select to authenticated using(not hidden and not internal.blocked(auth.uid(),author_id) and exists(select 1 from public.questions where id=question_id));
create policy visible_answer_comments on public.answer_comments for select to authenticated using(not internal.blocked(auth.uid(),author_id) and exists(select 1 from public.answers where id=answer_id));
create policy visible_resources on public.resources for select to authenticated using(internal.active(auth.uid()) and not hidden and not internal.blocked(auth.uid(),author_id));
revoke execute on function internal.community_member(text) from public,anon,authenticated;
insert into public.communities(id,name,description,category,subject_id) values
('math','Engineering Mathematics','Work through the concepts that make engineering click.','Subject','math'),
('linear','Linear Algebra','Find your footing with matrices, vector spaces and eigenvalues.','Subject','linear'),
('physics','Physics Lab','Ask why, explain how and make sense of physical systems.','Subject','physics'),
('aero','Aerospace Engineering','Explore flight, structures and the science of designing aircraft.','Subject','aero'),
('cs','Computer Science','Talk algorithms, software systems and good programming habits.','Subject','cs'),
('bio','Biology','Connect the ideas behind living systems.','Subject','bio'),
('bengaluru','Bengaluru Students','Connect around local academics and public campus study spaces.','Local',null),
('exams','Exam Preparation','Organize revision, clarify doubts and share original practice.','Exam',null),
('first-year','First-Year Engineering','Find your footing in the first year of an engineering degree.','University',null);
insert into public.community_channels(community_id,name) select id,'General' from public.communities;
insert into public.community_channels(community_id,name) values('linear','Eigenvalues'),('aero','Flight stability'),('exams','Revision plans');
