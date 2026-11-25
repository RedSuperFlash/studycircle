import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Award,
  BarChart3,
  Download,
  GraduationCap,
  LocateFixed,
  LogOut,
  MapPin,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  Area,
  Avatar,
  Button,
  ButtonLink,
  Check,
  Disclosure,
  Empty,
  Feedback,
  Field,
  Form,
  PageTitle,
  Person,
  QueryState,
  Section,
  Select,
  SubjectSelect,
  Tabs,
  downloadJSON,
  field,
  optional,
  optionsFrom,
} from '../components/ui';
import { Report } from '../components/Safety';
import { BrowserPush } from '../features/notifications/BrowserPush';
import { MetricChart, weekSeries } from '../components/Charts';
import { useAction, useRows, useRPC, useWorkspace } from '../hooks/workspace';
import { supabase } from '../lib/supabase';
import { dateLabel, deltaDays } from '../lib/format';
import type { Row } from '../types';
import { availability } from './Connect';
const tabs = ['Student profile', 'Progress', 'Privacy', 'Account'];
export default function Profile({
  install,
  exitDemo,
}: {
  install: (() => void) | null;
  exitDemo: () => void;
}) {
  const { user } = useWorkspace();
  const [p] = useSearchParams();
  const tab = p.get('tab') || tabs[0];
  const profile = useRows('profiles', { where: { id: user } });
  const me = profile.data[0];
  return (
    <>
      <PageTitle
        title="Profile"
        detail="Manage how you learn, what you share and who can reach you."
      />
      <Tabs labels={tabs} />
      <QueryState {...profile} />
      {me &&
        (tab === 'Progress' ? (
          <Progress />
        ) : tab === 'Privacy' ? (
          <Privacy />
        ) : tab === 'Account' ? (
          <Account install={install} exitDemo={exitDemo} />
        ) : (
          <StudentProfile me={me} />
        ))}
    </>
  );
}
function StudentProfile({ me }: { me: Row }) {
  const { db, user } = useWorkspace();
  const action = useAction();
  const preferences = useRows('student_preferences', { where: { user_id: user } });
  const levels = useRows('education_levels', { order: 'name' }),
    courses = useRows('courses', { order: 'name' }),
    institutions = useRows('institutions', { order: 'name' });
  const subjects = useRows('subjects', { order: 'name' });
  const mySubjects = useRows('student_subjects', { where: { user_id: user } });
  const times = useRows('student_availability', { where: { user_id: user } });
  const privateData = useRows('private_profiles', { where: { user_id: user } });
  const [selectedAvatar, setAvatar] = useState(me.avatar);
  const verified = privateData.data[0]?.institution_verified;
  return (
    <div className="two-column">
      <Section title="Student details">
        <div className="profile-banner">
          <Avatar name={me.display_name || me.alias} tone={selectedAvatar} size="large" />
          <div>
            <h3>{me.display_name || me.alias}</h3>
            <p>
              {verified ? 'Institution verified' : 'Student'} · {me.alias}
            </p>
          </div>
        </div>
        {levels.loading || courses.loading || institutions.loading || preferences.loading ? (
          <QueryState loading />
        ) : (
          <Form
            reset={false}
            onSubmit={(d) =>
              action.run(async () => {
                await db.update(
                  'profiles',
                  { id: user },
                  {
                    display_name: optional(d, 'name'),
                    bio: optional(d, 'bio'),
                    identifiable: d.has('identifiable'),
                    avatar: selectedAvatar,
                    institution_id: optional(d, 'institution'),
                    education_id: optional(d, 'level'),
                    course_id: optional(d, 'course'),
                    study_year: field(d, 'year') ? Number(field(d, 'year')) : null,
                    language: field(d, 'language'),
                  },
                );
                await db.update(
                  'student_preferences',
                  { user_id: user },
                  { learning_method: optional(d, 'method') },
                );
              }, 'Profile saved.')
            }
          >
            <Field
              name="name"
              label="Display name"
              maxLength={60}
              defaultValue={me.display_name || ''}
            />
            <Check name="identifiable" defaultChecked={me.identifiable}>
              Show my display name, bio and selected institution to other students
            </Check>
            <Area name="bio" label="Short bio" maxLength={300} defaultValue={me.bio || ''} />
            <div className="avatar-options" aria-label="Avatar color">
              {['iris', 'fern', 'sun', 'sky'].map((t) => (
                <Button
                  key={t}
                  aria-label={t + ' avatar'}
                  aria-pressed={selectedAvatar === t}
                  onClick={() => setAvatar(t)}
                >
                  <Avatar name={me.display_name || me.alias} tone={t} />
                </Button>
              ))}
            </div>
            <div className="form-grid">
              <Select
                name="institution"
                label="Institution"
                options={optionsFrom(institutions.data)}
                defaultValue={me.institution_id || ''}
                placeholder="Prefer not to say"
              />
              <Select
                name="level"
                label="Education level"
                options={optionsFrom(levels.data)}
                defaultValue={me.education_id || ''}
                placeholder="Select a level"
              />
              <Select
                name="course"
                label="Course or degree"
                options={optionsFrom(courses.data)}
                defaultValue={me.course_id || ''}
                placeholder="Select a course"
              />
              <Field
                name="year"
                label="Year of study"
                type="number"
                min={1}
                max={10}
                defaultValue={me.study_year ?? ''}
              />
              <Field
                name="language"
                label="Preferred language"
                defaultValue={me.language || 'English'}
                required
                maxLength={35}
              />
              <Field
                name="method"
                label="Preferred learning method"
                defaultValue={preferences.data[0]?.learning_method || ''}
                maxLength={100}
              />
            </div>
            <Button className="primary" type="submit" disabled={action.busy}>
              Save student profile
            </Button>
            <Feedback {...action} />
          </Form>
        )}
      </Section>
      <div>
        <Section title="Academic subjects">
          {mySubjects.data.map((s) => (
            <div className="list-row" key={s.subject_id + s.mode}>
              <span>
                <strong>
                  {subjects.data.find((x) => x.id === s.subject_id)?.name || s.subject_id}
                </strong>
                <small>
                  {s.mode === 'mentor'
                    ? 'Can help'
                    : s.mode === 'learn'
                      ? 'Needs support'
                      : 'Learning interest'}
                  {s.topic ? ' · ' + s.topic : ''}
                </small>
              </span>
              <Button
                className="icon-button"
                aria-label={'Remove ' + s.mode + ' profile subject'}
                onClick={() =>
                  void action.run(
                    () =>
                      db.remove('student_subjects', {
                        user_id: user,
                        subject_id: s.subject_id,
                        mode: s.mode,
                      }),
                    'Subject removed.',
                  )
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          <Form
            onSubmit={(d) =>
              action.run(
                () =>
                  db.insert('student_subjects', {
                    user_id: user,
                    subject_id: field(d, 'subject'),
                    mode: field(d, 'mode'),
                    topic: optional(d, 'topic'),
                  }),
                'Subject added.',
              )
            }
          >
            <SubjectSelect />
            <Select
              name="mode"
              label="How you study this subject"
              options={[
                { value: 'mentor', label: 'I can help' },
                { value: 'learn', label: 'I need support' },
                { value: 'interest', label: 'I’m interested' },
              ]}
            />
            <Field name="topic" label="Specific topic" maxLength={100} />
            <Button type="submit" disabled={action.busy}>
              Add subject
            </Button>
          </Form>
        </Section>
        <Section title="Availability">
          {availability.map((slot) => (
            <label className="check" key={slot}>
              <input
                type="checkbox"
                checked={times.data.some((t) => t.slot === slot)}
                disabled={action.busy}
                onChange={(e) =>
                  void action.run(() =>
                    e.target.checked
                      ? db.insert('student_availability', { user_id: user, slot })
                      : db.remove('student_availability', { user_id: user, slot }),
                  )
                }
              />
              {slot}
            </label>
          ))}
          <p className="fine-print">
            <GraduationCap size={16} /> Peer mentors are fellow students.
          </p>
        </Section>
      </div>
    </div>
  );
}
function Privacy() {
  const { db, user } = useWorkspace();
  const action = useAction();
  const p = useRows('private_profiles', { where: { user_id: user } });
  const regions = useRows('geographic_regions', { order: 'name' });
  const blocked = useRows('blocked_users', { where: { owner_id: user } });
  const prefs = useRows('student_preferences', { where: { user_id: user } });
  return (
    <div className="two-column">
      <div>
        <Location current={p.data[0]} regions={regions.data} />
        <Section title="Blocked students">
          <Feedback {...action} />
          {blocked.data.map((b) => (
            <div className="list-row" key={b.blocked_id}>
              <span>Blocked member · {String(b.blocked_id).slice(0, 8)}</span>
              <Button
                onClick={() =>
                  void action.run(
                    () => db.remove('blocked_users', { owner_id: user, blocked_id: b.blocked_id }),
                    'Student unblocked.',
                  )
                }
              >
                Unblock
              </Button>
            </div>
          ))}
          {!blocked.data.length && <Empty icon={ShieldCheck} title="No blocked students" />}
        </Section>
      </div>
      <Section title="Notification preferences">
        <p className="muted">
          Message notifications contain a generic alert. Muting a chat also stops its alerts.
        </p>
        {['requests', 'messages', 'community', 'groups', 'study', 'feedback', 'moderation'].map(
          (c) => (
            <label className="check" key={c}>
              <input
                type="checkbox"
                checked={!prefs.data[0]?.muted_categories?.includes(c)}
                disabled={action.busy}
                onChange={(e) => {
                  const current = (prefs.data[0]?.muted_categories || []) as string[];
                  void action.run(
                    () =>
                      db.update(
                        'student_preferences',
                        { user_id: user },
                        {
                          muted_categories: e.target.checked
                            ? current.filter((v) => v !== c)
                            : [...current, c],
                        },
                      ),
                    'Notification preferences updated.',
                  );
                }}
              />
              {c[0].toUpperCase() + c.slice(1)}
            </label>
          ),
        )}
        <BrowserPush />
        <Feedback {...action} />
      </Section>
    </div>
  );
}
function Location({ current, regions }: { current?: Row; regions: Row[] }) {
  const { db } = useWorkspace();
  const action = useAction();
  const [selection, setSelection] = useState<string | null>(null),
    [geoError, setGeoError] = useState('');
  const identify = () => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Location permission is unavailable. Select an area manually.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) => {
        const known = [
          ['bengaluru', 12.97, 77.59, 0.32, 0.35],
          ['pune', 18.52, 73.86, 0.3, 0.35],
          ['delhi', 28.61, 77.21, 0.42, 0.4],
        ] as const;
        const area = known.find(
          ([, lat, lon, dy, dx]) =>
            Math.abs(latitude - lat) <= dy && Math.abs(longitude - lon) <= dx,
        );
        if (area && regions.some((r) => r.id === area[0])) setSelection(area[0]);
        else setGeoError('No approximate area is mapped nearby. Select your area manually.');
      },
      () => setGeoError('Location permission was unavailable. Select an area manually.'),
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 9000 },
    );
  };
  return (
    <Section title="Local discovery">
      <p>
        Choose an approximate area. StudyCircle saves the selected region only and applies a minimum
        group size before making local recommendations.
      </p>
      <Form
        reset={false}
        key={String(current?.location_opt_in)}
        onSubmit={(d) =>
          action.run(
            () =>
              db.rpc('set_location', {
                region: optional(d, 'region'),
                discoverable: d.has('discoverable'),
              }),
            'Location preference saved.',
          )
        }
      >
        <Select
          label="Preferred area"
          name="region"
          options={optionsFrom(regions)}
          placeholder="No area selected"
          value={selection ?? current?.region_id ?? ''}
          onChange={setSelection}
        />
        <Button onClick={identify}>
          <LocateFixed size={16} /> Suggest an area from my location
        </Button>
        <Feedback error={geoError} />
        <Check name="discoverable" defaultChecked={current?.location_opt_in}>
          Opt into local study discovery
        </Check>
        <Button className="primary" type="submit" disabled={action.busy}>
          <MapPin size={16} /> Save location preference
        </Button>
        <Feedback {...action} />
      </Form>
    </Section>
  );
}
function Progress() {
  const { db } = useWorkspace();
  const action = useAction();
  const metrics = useRPC<Row>('my_analytics', undefined, {});
  const activity = (metrics.data.activity || []) as Row[];
  const attempts = useRows('quiz_attempts', { order: 'created_at', limit: 30 });
  const badges = useRows('badges');
  const earned = useRows('user_badges');
  const reviews = useRPC<Row[]>('my_review_summary', undefined, []);
  const notes = useRPC<Row[]>('my_review_notes', undefined, []);
  const exams = useRows('examinations', { order: 'exam_on' });
  const subjects = useRows('subjects');
  const minutes = activity.reduce((sum, r) => sum + Number(r.minutes), 0);
  const days = new Set(activity.map((r) => r.day)).size;
  const bySubject = subjects.data
    .map((s) => ({
      name: s.name,
      value: activity
        .filter((d) => d.subject_id === s.id)
        .reduce((sum, r) => sum + Number(r.minutes), 0),
    }))
    .filter((s) => s.value > 0);
  const data = [
    ['Study minutes', minutes],
    ['Study days', days],
    ['Completed sessions', metrics.data.sessions ?? 0],
    ['Questions asked', metrics.data.questions ?? 0],
    ['Explanations', metrics.data.answers ?? 0],
    ['Goals completed', metrics.data.goals ?? 0],
    ['Flashcards reviewed', metrics.data.flashcards ?? 0],
  ];
  return (
    <>
      <QueryState {...metrics} />
      <div className="metric-grid">
        {data.map(([label, value]) => (
          <div className="panel metric" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="two-column">
        <Section title="Weekly study time">
          <MetricChart data={weekSeries(activity)} height={200} />
        </Section>
        <Section title="Time by subject">
          {bySubject.length ? (
            <MetricChart data={bySubject} height={200} />
          ) : (
            <Empty
              icon={BarChart3}
              title="No subject activity yet"
              detail="Record a focus block with a subject to start seeing your distribution."
            />
          )}
        </Section>
        <Section title="Quiz performance">
          {attempts.data.length ? (
            <MetricChart
              label="Percent correct"
              data={attempts.data
                .slice(-8)
                .map((q) => ({
                  name: dateLabel(q.created_at),
                  value: Math.round((100 * q.score) / q.total),
                }))}
            />
          ) : (
            <Empty title="No quiz attempts yet" />
          )}
        </Section>
        <Section title="Upcoming examinations">
          {exams.data
            .filter((e) => deltaDays(e.exam_on) >= 0)
            .map((e) => (
              <Link className="list-row" to="/study?tab=Exams" key={e.id}>
                {e.title}
                <span className="chip">{deltaDays(e.exam_on)} days</span>
              </Link>
            ))}
          {!exams.data.some((e) => deltaDays(e.exam_on) >= 0) && (
            <Empty title="No upcoming exams" />
          )}
        </Section>
        <Section
          title="Achievements"
          action={
            <Button
              onClick={() =>
                void action.run(() => db.rpc('refresh_badges'), 'Achievements checked.')
              }
            >
              Check achievements
            </Button>
          }
        >
          <Feedback {...action} />
          <div className="badges">
            {badges.data
              .filter((b) => earned.data.some((e) => e.badge_id === b.id))
              .map((b) => (
                <span className="chip" title={b.description} key={b.id}>
                  <Award size={17} />
                  {b.name}
                </span>
              ))}
          </div>
          {!earned.data.length && <Empty icon={Award} title="Milestones you earn appear here" />}
        </Section>
        <Section title="Anonymous feedback">
          {reviews.data[0] ? (
            <>
              <p className="activity-number">{reviews.data[0].overall} / 5</p>
              <p>{reviews.data[0].review_count} distinct peer reviewers</p>
              <div className="badges">
                {reviews.data[0].recognition?.map((r: string) => (
                  <span key={r} className="chip">
                    {r}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <Empty
              title="Feedback aggregate pending"
              detail="Your private summary appears after feedback from at least three different eligible students."
            />
          )}
          {notes.data.map((note) => (
            <div className="comment" key={note.id}>
              <p>{note.note}</p>
              <Report kind="review" item={note.id!} />
            </div>
          ))}
          <QueryState {...reviews} />
        </Section>
      </div>
    </>
  );
}
function Account({ install, exitDemo }: { install: (() => void) | null; exitDemo: () => void }) {
  const { db, user, demo, role } = useWorkspace();
  const action = useAction();
  const actions = useRows('moderation_actions', {
    where: { user_id: user },
    order: 'created_at',
    desc: true,
  });
  const appeals = useRows('moderation_appeals', { where: { user_id: user } });
  const reports = useRows('reports', {
    where: { reporter_id: user },
    order: 'created_at',
    desc: true,
  });
  const verification = useRows('verification_requests', { where: { user_id: user } });
  return (
    <div className="two-column">
      <Section title="Your account">
        <p className="muted">Only share your student ID with a study-group leader you trust.</p>
        <p className="user-id">{user}</p>
        <div className="button-row">
          <Button
            disabled={action.busy}
            onClick={() =>
              void action.run(
                async () => downloadJSON(await db.rpc('my_data_export'), 'studycircle-export.json'),
                'Export prepared.',
              )
            }
          >
            <Download size={16} /> Export my data
          </Button>
          {demo ? (
            supabase && <Button onClick={exitDemo}>Exit classroom demo</Button>
          ) : (
            <Button
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  if ('serviceWorker' in navigator) {
                    try {
                      const registration = await navigator.serviceWorker.getRegistration();
                      const push = await registration?.pushManager?.getSubscription();
                      if (push) {
                        try {
                          await db.rpc('manage_push_subscription', {
                            device_endpoint: push.endpoint,
                          });
                        } finally {
                          await push.unsubscribe();
                        }
                      }
                    } catch (error) {
                      console.warn(error);
                    }
                  }
                  const { error } = await supabase!.auth.signOut();
                  if (error) throw error;
                })
              }
            >
              <LogOut size={17} /> Log out
            </Button>
          )}
        </div>
        {(role === 'moderator' || role === 'admin') && (
          <ButtonLink to="/admin">Open moderation workspace</ButtonLink>
        )}
        {install ? (
          <Button onClick={install}>
            <Download size={16} /> Install StudyCircle
          </Button>
        ) : (
          <p className="fine-print">
            Use your browser’s install or Add to Home Screen option when available.
          </p>
        )}
        <Link className="text-link" to="/overview">
          Project overview
        </Link>
        {!demo && (
          <Disclosure label="Institutional verification">
            <p className="muted">
              Use a confirmed account email from your selected institution’s configured domain.
            </p>
            <Button
              disabled={action.busy}
              onClick={() =>
                void action.run(
                  () => db.rpc('request_verification'),
                  'Verification request submitted.',
                )
              }
            >
              Request verification
            </Button>
            {verification.data.map((v) => (
              <p className="chip" key={v.id}>
                {v.status}
              </p>
            ))}
          </Disclosure>
        )}
        {!demo && (
          <Disclosure label="Delete my account">
            <p>
              This permanently deletes your account, private study history and authored messages.
              Community contributions may remain disconnected from your profile.
            </p>
            <Form
              onSubmit={(d) =>
                action.run(async () => {
                  if (field(d, 'confirm') !== 'DELETE') throw new Error('Type DELETE to confirm.');
                  const { error } = await supabase!.functions.invoke('delete-account', {
                    body: { confirm: 'DELETE' },
                  });
                  if (error)
                    throw new Error(
                      'Deletion could not be confirmed. Check that the delete-account function is deployed.',
                    );
                  await supabase!.auth.signOut({ scope: 'local' });
                })
              }
            >
              <Field label="Type DELETE to confirm" name="confirm" required />
              <Button className="danger" type="submit" disabled={action.busy}>
                Delete account permanently
              </Button>
            </Form>
          </Disclosure>
        )}
        <Feedback {...action} />
      </Section>
      <Section title="Moderation and appeals">
        <QueryState {...actions} />
        {reports.data.map((r) => (
          <p className="list-row" key={r.id}>
            Your report · {r.category}
            <span className="chip">{r.status}</span>
          </p>
        ))}
        {actions.data.map((a) => (
          <Disclosure key={a.id} label={a.action + ' · ' + dateLabel(a.created_at)}>
            <p>{a.note}</p>
            {appeals.data.some((x) => x.action_id === a.id) ? (
              <span className="chip">
                Appeal · {appeals.data.find((x) => x.action_id === a.id)?.status}
              </span>
            ) : (
              <Form
                onSubmit={(d) =>
                  action.run(
                    () => db.rpc('appeal_action', { action_id: a.id, details: field(d, 'reason') }),
                    'Appeal submitted.',
                  )
                }
              >
                <Area
                  label="Why should this be reconsidered?"
                  name="reason"
                  required
                  maxLength={2000}
                />
                <Button type="submit" disabled={action.busy}>
                  Submit appeal
                </Button>
              </Form>
            )}
          </Disclosure>
        ))}
        {!actions.data.length && !reports.data.length && <Empty title="No moderation updates" />}
        <Feedback {...action} />
      </Section>
    </div>
  );
}
