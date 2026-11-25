-- Fictional classroom accounts. Apply with local Supabase only.
-- Real project deployments must use migration-only commands and independent accounts.
create extension if not exists pgcrypto with schema extensions;
do $$
declare profile record;
begin
 for profile in select * from (values
  ('85010000-0000-4000-8000-000000000001'::uuid,'maya','Maya Rao','iris','aero'),
  ('85010000-0000-4000-8000-000000000002'::uuid,'ishaan','Ishaan Mehta','fern','math'),
  ('85010000-0000-4000-8000-000000000003'::uuid,'nia','Nia Fernandes','sun','cs'),
  ('85010000-0000-4000-8000-000000000004'::uuid,'arjun','Arjun Sen','sky','physics'),
  ('85010000-0000-4000-8000-000000000005'::uuid,'leena','Leena Shah','iris','other'),
  ('85010000-0000-4000-8000-000000000006'::uuid,'jas','Jas Kapoor','fern','math'),
  ('85010000-0000-4000-8000-000000000007'::uuid,'mira','Mira Thomas','sun','math'),
  ('85010000-0000-4000-8000-000000000008'::uuid,'dev','Dev Kumar','iris','cs'),
  ('85010000-0000-4000-8000-000000000009'::uuid,'riya','Riya Bose','sky','math')
 ) as learner(id,handle,name,avatar,course_id)
 loop
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
  values('00000000-0000-0000-0000-000000000000',profile.id,'authenticated','authenticated',profile.handle||'@classroom.example',extensions.crypt('Local-Classroom-Only!26',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"adult":true,"fictional":true}',now(),now(),'','','','')
  on conflict(id) do nothing;
  insert into auth.identities(user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
  values(profile.id,profile.id::text,jsonb_build_object('sub',profile.id,'email',profile.handle||'@classroom.example','email_verified',true),'email',now(),now(),now()) on conflict(provider_id,provider) do nothing;
  update public.profiles set display_name=profile.name,identifiable=true,avatar=profile.avatar,course_id=profile.course_id,education_id='undergrad',study_year=1 where id=profile.id;
  update public.private_profiles set location_opt_in=true,region_id='bengaluru' where user_id=profile.id;
  insert into public.student_availability values(profile.id,'Weekday evenings') on conflict do nothing;
  if profile.handle in ('ishaan','jas','mira','dev','riya') then
   insert into public.student_subjects values(profile.id,'linear','mentor','Eigenvalues and eigenvectors') on conflict do nothing;
  end if;
 end loop;
end $$;
insert into public.user_roles values('85010000-0000-4000-8000-000000000005','moderator') on conflict do nothing;
insert into public.student_subjects values
 ('85010000-0000-4000-8000-000000000001','linear','learn','Eigenvalues and eigenvectors'),
 ('85010000-0000-4000-8000-000000000001','aero','mentor','Flight mechanics'),
 ('85010000-0000-4000-8000-000000000003','cs','mentor','Algorithms'),
 ('85010000-0000-4000-8000-000000000004','physics','mentor','Dynamics')
 on conflict do nothing;
insert into public.community_members(community_id,user_id) values
 ('linear','85010000-0000-4000-8000-000000000001'),
 ('linear','85010000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.questions(id,subject_id,title,body,topic,answer_count)
values('85110000-0000-4000-8000-000000000001','aero','How do eigenvalues determine aircraft stability?','What do the real and imaginary parts tell us about how the aircraft responds to a small disturbance?','Flight stability',1) on conflict do nothing;
insert into internal.question_owners values('85110000-0000-4000-8000-000000000001','85010000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.answers(id,question_id,author_id,body) values('85210000-0000-4000-8000-000000000001','85110000-0000-4000-8000-000000000001','85010000-0000-4000-8000-000000000002',$text$For $\dot{x}=Ax$, the mode associated with $\lambda$ goes like $e^{\lambda t}$. The real part gives its growth or decay rate. The imaginary part gives its oscillation frequency.$text$) on conflict do nothing;
insert into public.study_tasks(user_id,title,due_on,subject_id,kind,priority) values('85010000-0000-4000-8000-000000000001','Review eigenvalues and eigenvectors',current_date,'linear','Revision','High');
insert into public.examinations(user_id,title,exam_on,subject_id) values('85010000-0000-4000-8000-000000000001','Linear Algebra midterm',current_date+6,'linear');
insert into public.focus_logs(user_id,subject_id,minutes,created_at) select '85010000-0000-4000-8000-000000000001','linear',20+n*5,now()-make_interval(days=>n) from generate_series(0,6) n;
insert into public.study_groups(id,owner_id,name,description,subject_id,topic,category,capacity,privacy,format)
 values('85310000-0000-4000-8000-000000000001','85010000-0000-4000-8000-000000000001','Linear Algebra Revision Circle','Practice eigenvalue problems together.','linear','Eigenvalues','Subject revision',8,'Open','Online') on conflict do nothing;
insert into public.study_group_members values
 ('85310000-0000-4000-8000-000000000001','85010000-0000-4000-8000-000000000001','active'),
 ('85310000-0000-4000-8000-000000000001','85010000-0000-4000-8000-000000000002','active') on conflict do nothing;
insert into public.study_rooms(id,objective) values('85310000-0000-4000-8000-000000000001','Solve two characteristic polynomial examples.') on conflict do nothing;
insert into public.conversations(id,title) values('85310000-0000-4000-8000-000000000001','Linear Algebra Revision Circle') on conflict do nothing;
insert into public.conversation_participants(conversation_id,user_id) values
 ('85310000-0000-4000-8000-000000000001','85010000-0000-4000-8000-000000000001'),
 ('85310000-0000-4000-8000-000000000001','85010000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.room_tasks(id,room_id,title) values('85410000-0000-4000-8000-000000000001','85310000-0000-4000-8000-000000000001','Find the eigenvalues of a triangular matrix') on conflict do nothing;
insert into public.messages(id,conversation_id,author_id,body) values('85510000-0000-4000-8000-000000000001','85310000-0000-4000-8000-000000000001','85010000-0000-4000-8000-000000000002','That question is stupid. Stop wasting our time.') on conflict do nothing;
