import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

process.on('uncaughtException', (error) => {
  console.error(error.message, error.where ?? '', error.detail ?? '');
  if (error.query) console.error('Query:', String(error.query).slice(0, 240));
  process.exit(1);
});
const db = new PGlite();
const query = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await query(sql, params))[0];
const exec = (sql) => db.exec(sql);
await exec(await readFile(new URL('./platform.sql', import.meta.url), 'utf8'));
const migrations = new URL('../../supabase/migrations/', import.meta.url);
for (const name of (await readdir(migrations)).filter((n) => n.endsWith('.sql')).sort()) {
  try {
    await exec(await readFile(new URL(name, migrations), 'utf8'));
    console.log('Applied', name);
  } catch (error) {
    console.error(
      'Migration failed:',
      name,
      error.message,
      error.detail ?? '',
      error.position ?? '',
    );
    throw error;
  }
}
const ids = Array.from(
  { length: 10 },
  (_, i) => '00000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'),
);
const [maya, ishaan, outsider, staff, admin, ...cohort] = ids;
const switchUser = async (user) => {
  await exec('reset role');
  await query("select set_config('request.jwt.claim.sub',$1,false)", [user || '']);
  await exec(user ? 'set role authenticated' : 'set role anon');
};
const owner = () => exec('reset role');
const rejects = async (promise, pattern) => assert.rejects(promise, pattern);

await rejects(
  query(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,'minor@example.test','{}')",
    [maya],
  ),
  /18\+/,
);
for (const [i, id] of ids.entries())
  await query(
    'insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),\'{"adult":true}\')',
    [id, 'student' + i + '@example.test'],
  );
await query("insert into public.user_roles values($1,'moderator'),($2,'admin')", [staff, admin]);
await switchUser(null);
await rejects(query('select * from public.profiles'), /permission denied/);
await rejects(query("select public.send_request($1,'linear')", [ishaan]), /permission denied/);

await switchUser(maya);
assert.equal((await query('select id from public.profiles')).length, 1);
assert.equal((await query('select * from public.person($1)', [ishaan]))[0].institution_id, null);
await rejects(
  query("insert into public.user_roles values($1,'admin')", [maya]),
  /permission denied/,
);
await rejects(
  query('update public.private_profiles set suspended_until=now()'),
  /permission denied/,
);
await rejects(query('select public.admin_metrics()'), /Administrator/);
await rejects(query("select public.send_message($1,'Do not deliver')", [ishaan]), /denied/);
await query(
  "insert into public.student_subjects values($1,'linear','learn','Eigenvalues and eigenvectors')",
  [maya],
);
await query("select public.set_location('bengaluru',true)");
await switchUser(ishaan);
await query(
  "insert into public.student_subjects values($1,'linear','mentor','Eigenvalues and eigenvectors')",
  [ishaan],
);
await query("insert into public.student_availability values($1,'Weekday evenings')", [ishaan]);
await query("update public.profiles set education_id='undergrad' where id=$1", [ishaan]);
await query("select public.set_location('bengaluru',true)");

await switchUser(maya);
const search =
  "select * from public.find_partners('linear','Get help','Eigenvalues and eigenvectors','undergrad','English','Weekday evenings',50,$1,false)";
const match = await one(search, ['worldwide']);
assert.equal(match.score, 95);
assert.equal(match.id, ishaan);
assert.equal((await query(search, ['radius-5'])).length, 0);
await owner();
for (const peer of cohort) {
  await query(
    "insert into public.student_subjects values($1,'linear','mentor','Eigenvalues and eigenvectors')",
    [peer],
  );
  await query(
    "update public.private_profiles set region_id='bengaluru',location_opt_in=true where user_id=$1",
    [peer],
  );
}
await switchUser(maya);
assert.equal((await query(search, ['radius-5'])).length, 6);
await rejects(query(search, ['state']), /one local area/);
const req = (await one("select public.send_request($1,'linear') id", [ishaan])).id;
await rejects(query("select public.send_request($1,'linear')", [ishaan]), /duplicate/);
await rejects(query("select public.respond_request($1,'accepted')", [req]), /cannot be changed/);
await switchUser(outsider);
assert.equal((await query('select * from public.study_requests')).length, 0);
await rejects(query("select public.respond_request($1,'accepted')", [req]), /cannot be changed/);
await switchUser(ishaan);
const session = (await one("select public.respond_request($1,'accepted') room", [req])).room;
await query("select public.send_message($1,'A classroom example')", [session]);
await query('select public.chat_signal($1,true)', [session]);
assert.equal((await query('select * from public.chat_presence')).length, 1);
await switchUser(outsider);
assert.equal(
  (await query('select * from public.messages where conversation_id=$1', [session])).length,
  0,
);
await rejects(
  query("select public.report_content('message',$1,'Harassment','Not a participant')", [session]),
  /cannot be reported/,
);
await switchUser(maya);
assert.equal((await query('select * from public.messages')).length, 1);
assert.equal((await one('select unread from public.chat_unread')).unread, 1);
assert.equal((await one('select public.complete_session($1) done', [session])).done, false);
await rejects(
  query('select public.submit_review($1,ARRAY[5,5,5,5,5,5,5,5])', [session]),
  /unavailable/,
);
await switchUser(ishaan);
assert.equal((await one('select public.complete_session($1) done', [session])).done, true);
await switchUser(maya);
await query(
  "select public.submit_review($1,ARRAY[5,5,5,5,5,5,5,5],'Great explainer','Clear explanation')",
  [session],
);
await rejects(
  query('select public.submit_review($1,ARRAY[5,5,5,5,5,5,5,5])', [session]),
  /already submitted/,
);
await rejects(query('select * from public.reviews'), /permission denied/);
await switchUser(ishaan);
assert.equal((await query('select * from public.my_review_summary()')).length, 0);
await switchUser(maya);
const message = (await one('select id from public.messages where conversation_id=$1', [session]))
  .id;
const report = (
  await one("select public.report_content('message',$1,'Harassment','Fictional report') id", [
    message,
  ])
).id;
await rejects(query('select * from public.inspect_report($1)', [report]), /Moderator/);
await switchUser(staff);
await rejects(query('select public.admin_directory()'), /Administrator/);
await query('select public.claim_report($1)', [report]);
assert.equal(
  (await query('select * from public.messages where conversation_id=$1', [session])).length,
  0,
);
assert.equal(
  (await one('select * from public.inspect_report($1)', [report])).content,
  'A classroom example',
);
await query("select public.resolve_report($1,'hide','Hide reported classroom message')", [report]);
assert.equal((await query('select * from public.audit_logs')).length, 3);
await switchUser(maya);
assert.equal((await query('select * from public.messages')).length, 0);
await query('insert into public.blocked_users values($1,$2,now())', [maya, ishaan]);
await switchUser(ishaan);
await rejects(query("select public.send_message($1,'Blocked message')", [session]), /denied/);
await switchUser(maya);
await query("insert into public.community_members values('linear',$1,now())", [maya]);
const question = (
  await one(
    "select public.post_question('Why do eigenvalues matter?','A worked example question','linear','Eigenvalues',null,true,'linear') id",
  )
).id;
assert.equal(
  (await one('select author_id from public.questions where id=$1', [question])).author_id,
  null,
);
await switchUser(outsider);
const answer = (
  await one("select public.add_answer($1,'The sign of the real part affects stability.') id", [
    question,
  ])
).id;
await rejects(
  query('select public.accept_answer($1,$2)', [question, answer]),
  /Only the question author/,
);
await switchUser(maya);
await query('select public.accept_answer($1,$2)', [question, answer]);
await query('select public.toggle_helpful($1)', [answer]);
assert.equal(
  (await one('select helpful_count from public.answers where id=$1', [answer])).helpful_count,
  1,
);
assert.equal(
  (await one('select accepted_answer_id from public.questions where id=$1', [question]))
    .accepted_answer_id,
  answer,
);
const team = (
  await one(
    "select public.create_group('Revision circle','Review eigenvalues','linear','Eigenvalues','Subject revision',8,'Approval','Online') id",
  )
).id;
await switchUser(outsider);
await query("select public.group_membership($1,'join')", [team]);
assert.equal((await query('select * from public.study_rooms')).length, 0);
await rejects(query('select public.start_timer($1,1,1)', [team]), /leader/);
await switchUser(maya);
await query("select public.group_membership($1,'approve',$2)", [team, outsider]);
await query('select public.room_ready($1,true)', [team]);
const timer = (await one('select public.start_timer($1,1,1) id', [team])).id;
await rejects(query('select public.start_timer($1,1,1)', [team]), /already running/);
await rejects(query('select public.log_room_attendance($1)', [timer]), /still running/);
await switchUser(outsider);
assert.equal((await query('select * from public.study_timers')).length, 1);
await switchUser(maya);
await query("insert into public.study_tasks(title,done) values('Private planner task',true)");
await query("insert into public.focus_logs(minutes,subject_id) values(25,'linear')");
await query('select public.refresh_badges()');
assert.equal((await one('select public.my_analytics() data')).data.activity[0].minutes, 25);
assert.equal((await query('select * from public.user_badges'))[0].badge_id, 'first');
const quiz = (
  await one(
    "insert into public.quizzes(title,community_id) values('Study quiz','linear') returning id",
  )
).id;
await query(
  "select public.add_quiz_item($1,'What is two plus two?',ARRAY['1','2','3','4'],3,'Four is the sum.')",
  [quiz],
);
const quizQuestion = (await one('select id from public.quiz_questions where quiz_id=$1', [quiz]))
  .id;
await query('select public.grade_quiz($1,$2::jsonb)', [
  quiz,
  JSON.stringify({ [quizQuestion]: 3 }),
]);
assert.equal((await one('select * from public.quiz_attempts')).score, 1);
assert.equal((await one('select public.my_data_export() data')).data.study_tasks.length, 1);
await switchUser(outsider);
assert.equal((await query('select * from public.study_tasks')).length, 0);
assert.equal((await query('select * from public.quiz_attempts')).length, 0);
await rejects(
  query("insert into public.study_tasks(user_id,title) values($1,'Forged task')", [maya]),
  /row-level security/,
);
await switchUser(admin);
assert.ok((await one('select public.admin_metrics() data')).data['Registered students'] >= 10);
assert.equal((await query('select * from public.admin_directory()')).length, 10);
await query(
  'select public.admin_action(\'institution\',\'campus\',\'save\',\'{"name":"Campus","domain":"example.test"}\')',
);
await query("select public.admin_action('user',$1,'warn','{\"note\":\"Classroom warning\"}')", [
  outsider,
]);
await query(
  "select public.admin_action('settings','announcement','save','{\"value\":\"A public notice\"}')",
);
await query("select public.admin_action('community','linear','archive')");
assert.equal((await query("select id from public.communities where id='linear'")).length, 0);
await query("select public.admin_action('community','linear','restore')");
await switchUser(outsider);
const warning = (await one("select id from public.moderation_actions where action='warn'")).id;
await query("select public.appeal_action($1,'Review this test action')", [warning]);
await query("update public.profiles set institution_id='campus' where id=auth.uid()");
await query('select public.request_verification()');
const verification = (await one('select id from public.verification_requests')).id;
await switchUser(admin);
await rejects(
  query("select public.resolve_appeal($1,'overturned')", [
    (await one('select id from public.moderation_appeals')).id,
  ]),
  /Another administrator/,
);
await query("select public.admin_action('verification',$1,'verified')", [verification]);
await switchUser(outsider);
assert.equal(
  (await one('select institution_verified from public.private_profiles')).institution_verified,
  true,
);
await switchUser(maya);
await query(
  "insert into storage.objects(bucket_id,name) values('study-resources',auth.uid()::text||'/original.txt')",
);
const resource = (
  await one(
    "select public.publish_resource('Original notes','A permitted summary','linear','Lecture notes',true,auth.uid()::text||'/original.txt') id",
  )
).id;
await query('insert into public.resource_bookmarks values($1,auth.uid())', [resource]);
await query('insert into public.resource_reactions values($1,auth.uid())', [resource]);
assert.equal((await one('select public.resource_helpful($1) total', [resource])).total, 1);
const post = (
  await one(
    "select public.publish_post('linear','Original topic','A discussion',null,ARRAY['Yes','No']) id",
  )
).id;
await query('select public.vote_poll($1,1)', [post]);
await query("select public.add_comment('post',$1,'A reply')", [post]);
assert.equal((await one('select votes from public.poll_results($1)', [post])).votes, 1);
await query("insert into public.study_tasks(title,due_on) values('Reminder test',current_date)");
await query('select public.sync_reminders(current_date)');
await query('select public.sync_reminders(current_date)');
assert.equal((await query("select id from public.notifications where category='study'")).length, 1);
await switchUser(outsider);
assert.equal(
  (await query("select name from storage.objects where bucket_id='study-resources'")).length,
  1,
);
await owner();
await query("update public.study_timers set started_at=now()-interval '61 seconds' where id=$1", [
  timer,
]);
await query(
  "update public.study_room_participants set ready_at=now()-interval '62 seconds' where room_id=$1 and user_id=$2",
  [team, maya],
);
await switchUser(maya);
assert.equal((await one('select public.log_room_attendance($1) minutes', [timer])).minutes, 1);
assert.equal((await one('select public.log_room_attendance($1) minutes', [timer])).minutes, 1);
assert.equal((await query('select * from public.room_attendance')).length, 1);
await switchUser(maya);
await rejects(query('select * from public.claim_push_batch()'), /permission denied/);
await rejects(
  query(
    "select public.manage_push_subscription('https://example.com/push',repeat('a',87),repeat('b',22))",
  ),
  /Unsupported push/,
);
await query(
  "select public.manage_push_subscription('https://fcm.googleapis.com/fcm/send/classroom',repeat('a',87),repeat('b',22))",
);
await owner();
await query(
  "insert into public.notifications(user_id,category,title) values($1,'messages','Generic test')",
  [maya],
);
await exec('set role service_role');
const batch = await query('select id,endpoint from public.claim_push_batch()');
assert.equal(batch.length, 1);
assert.match(batch[0].endpoint, /fcm\.googleapis\.com/);
await query("select public.finish_push_attempt($1,'expired')", [batch[0].id]);
assert.deepEqual(await query('select * from public.claim_push_batch()'), []);
await db.close();
console.log('Database authorization and workflow assertions passed.');
