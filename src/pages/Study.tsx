import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Layers,
  ListChecks,
  Play,
  Plus,
  Target,
  Timer,
  Trash2,
} from 'lucide-react';
import {
  Area,
  Button,
  ButtonLink,
  Disclosure,
  Empty,
  Feedback,
  Field,
  Form,
  PageTitle,
  Person,
  QueryState,
  RichText,
  Section,
  Select,
  SubjectIcon,
  SubjectSelect,
  Tabs,
  field,
  optional,
} from '../components/ui';
import { useAction, useRows, useWorkspace } from '../hooks/workspace';
import { clock, dateLabel, deltaDays, isoDay, timerPhase } from '../lib/format';
import type { Row } from '../types';
import { Chat } from './Connect';

const tabs = ['Planner', 'Focus timer', 'Rooms', 'Flashcards', 'Quizzes', 'Exams', 'Goals'];
export default function Study({ embedded = false }: { embedded?: boolean }) {
  const [p] = useSearchParams();
  const tab = p.get('tab') || tabs[0];
  return (
    <>
      {!embedded && (
        <PageTitle
          title="Study"
          detail="Plan your week, make time to focus and practice at your own pace."
        />
      )}
      <Tabs labels={tabs} />
      {tab === 'Focus timer' ? (
        <Focus />
      ) : tab === 'Rooms' ? (
        <Rooms room={p.get('room')} />
      ) : tab === 'Flashcards' ? (
        <Flashcards deck={p.get('deck')} />
      ) : tab === 'Quizzes' ? (
        <Quizzes quiz={p.get('quiz')} />
      ) : tab === 'Exams' ? (
        <Exams />
      ) : tab === 'Goals' ? (
        <Goals />
      ) : (
        <Planner />
      )}
    </>
  );
}
function Planner() {
  const { db, user } = useWorkspace();
  const action = useAction();
  const [params] = useSearchParams();
  const tasks = useRows('study_tasks', { order: 'due_on' });
  const [view, setView] = useState('Week'),
    [offset, setOffset] = useState(0),
    [create, setCreate] = useState(params.get('compose') === '1');
  const anchor = isoDay(offset * (view === 'Week' ? 7 : 1));
  const base = new Date(isoDay() + 'T12:00:00Z');
  if (view === 'Month') base.setUTCMonth(base.getUTCMonth() + offset, 1);
  useEffect(() => {
    if (params.get('compose') === '1') setCreate(true);
  }, [params]);
  let days: string[] = [anchor];
  if (view === 'Week')
    days = Array.from({ length: 7 }, (_, i) =>
      isoDay(offset * 7 - ((new Date(isoDay() + 'T12:00:00').getDay() + 6) % 7) + i),
    );
  if (view === 'Month')
    days = Array.from(
      { length: new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate() },
      (_, i) =>
        new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), i + 1, 12))
          .toISOString()
          .slice(0, 10),
    );
  const visible = tasks.data.filter((t) => !t.due_on || days.includes(t.due_on));
  const done = visible.filter((t) => t.done).length;
  const exams = useRows('examinations', { order: 'exam_on' });
  const revision = exams.data.find((e) => deltaDays(e.exam_on) >= 0 && deltaDays(e.exam_on) <= 14);
  return (
    <>
      <Section
        title="Study planner"
        action={
          <Button className="primary" onClick={() => setCreate(!create)}>
            <Plus size={17} />
            {create ? 'Close form' : 'Add study task'}
          </Button>
        }
      >
        <div className="calendar-top">
          <div className="segmented">
            {['Day', 'Week', 'Month'].map((x) => (
              <Button
                key={x}
                aria-pressed={x === view}
                onClick={() => {
                  setView(x);
                  setOffset(0);
                }}
              >
                {x}
              </Button>
            ))}
          </div>
          <div className="button-row">
            <Button
              aria-label="Previous period"
              className="icon-button"
              onClick={() => setOffset(offset - 1)}
            >
              <ChevronLeft size={19} />
            </Button>
            <strong>
              {dateLabel(
                days[0],
                view === 'Month'
                  ? { month: 'long', year: 'numeric' }
                  : { month: 'short', day: 'numeric' },
              )}
              {view === 'Week' ? ' – ' + dateLabel(days[6]) : ''}
            </strong>
            <Button
              aria-label="Next period"
              className="icon-button"
              onClick={() => setOffset(offset + 1)}
            >
              <ChevronRight size={19} />
            </Button>
          </div>
        </div>
        <div className={'calendar ' + (view === 'Day' ? 'calendar-day' : '')}>
          {days.map((day) => (
            <div className={'calendar-cell ' + (day === isoDay() ? 'current' : '')} key={day}>
              <span>{dateLabel(day, { weekday: 'short' })}</span>
              <strong>{dateLabel(day, { day: 'numeric' })}</strong>
              <small>{tasks.data.filter((x) => x.due_on === day).length || '–'}</small>
            </div>
          ))}
        </div>
        {create && (
          <Form
            className="inset-form"
            onSubmit={(d) =>
              action.run(
                () =>
                  db.insert('study_tasks', {
                    user_id: user,
                    title: field(d, 'title'),
                    subject_id: optional(d, 'subject'),
                    notes: optional(d, 'notes'),
                    due_on: optional(d, 'date'),
                    kind: field(d, 'kind'),
                    priority: field(d, 'priority'),
                  }),
                'Task added.',
              )
            }
          >
            <Field label="Task title" name="title" required maxLength={140} />
            <div className="form-grid">
              <SubjectSelect required={false} />
              <Field label="Due date" name="date" type="date" defaultValue={isoDay()} />
              <Select
                label="Task type"
                name="kind"
                options={['Study', 'Revision', 'Assignment', 'Session']}
              />
              <Select label="Priority" name="priority" options={['Normal', 'High', 'Low']} />
            </div>
            <Area label="Notes" name="notes" maxLength={1000} />
            <Button className="primary" type="submit" disabled={action.busy}>
              Save study task
            </Button>
          </Form>
        )}
        <QueryState {...tasks} />
        <Feedback {...action} />
        <div className="plan-summary">
          <span>
            {done} of {visible.length} tasks complete
          </span>
          <progress value={done} max={visible.length || 1} />
        </div>
        {visible.map((t) => (
          <div className="list-row" key={t.id}>
            <input
              aria-label={'Complete ' + t.title}
              type="checkbox"
              checked={t.done}
              onChange={() =>
                void action.run(() => db.update('study_tasks', { id: t.id! }, { done: !t.done }))
              }
            />
            <span>
              <strong>{t.title}</strong>
              <small>
                {t.kind} · {t.due_on ? dateLabel(t.due_on) : 'No due date'} · {t.priority} priority
              </small>
              {t.notes && <small>{t.notes}</small>}
            </span>
            <Button
              className="icon-button"
              aria-label={'Remove ' + t.title}
              onClick={() =>
                void action.run(() => db.remove('study_tasks', { id: t.id! }), 'Task removed.')
              }
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        {!tasks.loading && !visible.length && (
          <Empty
            icon={CalendarDays}
            title="No tasks for this period"
            detail="Add a revision session, assignment deadline or small study task."
          />
        )}
        {revision && (
          <div className="inline-note">
            <CalendarDays size={16} /> Plan a revision block for {revision.title}.{' '}
            <Link to="/study?tab=Exams">Open the revision checklist</Link>
          </div>
        )}
      </Section>
    </>
  );
}
function Goals() {
  const { db, user } = useWorkspace();
  const actions = useAction();
  const goals = useRows('study_goals', { order: 'target_on' });
  return (
    <div className="two-column">
      <Section title="Study goals">
        <QueryState {...goals} />
        {goals.data.map((g) => (
          <label className="list-row" key={g.id}>
            <input
              type="checkbox"
              checked={g.done}
              onChange={() =>
                void actions.run(() => db.update('study_goals', { id: g.id! }, { done: !g.done }))
              }
            />
            <span>
              <strong>{g.title}</strong>
              <small>{g.target_on ? 'Target ' + dateLabel(g.target_on) : 'No target date'}</small>
            </span>
          </label>
        ))}
        {!goals.loading && !goals.data.length && (
          <Empty
            icon={Target}
            title="What would you like to learn?"
            detail="Set a small, specific goal for your next study cycle."
          />
        )}
      </Section>
      <Section title="Add a goal">
        <Form
          onSubmit={(d) =>
            actions.run(
              () =>
                db.insert('study_goals', {
                  user_id: user,
                  title: field(d, 'title'),
                  subject_id: optional(d, 'subject'),
                  target_on: optional(d, 'target'),
                }),
              'Goal saved.',
            )
          }
        >
          <Field label="Goal" name="title" required maxLength={140} />
          <SubjectSelect required={false} />
          <Field label="Target date" name="target" type="date" />
          <Button className="primary" type="submit" disabled={actions.busy}>
            Save goal
          </Button>
          <Feedback {...actions} />
        </Form>
      </Section>
    </div>
  );
}
function useNow() {
  const [now, set] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => set(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return now;
}
function Focus() {
  const { db, user } = useWorkspace();
  const action = useAction();
  const now = useNow();
  const [timer, setTimer] = useState<{
    started: string;
    study: number;
    pause: number;
    subject: string | null;
    logged: boolean;
  } | null>(null);
  const phase = timer ? timerPhase(timer.started, timer.study, timer.pause, now) : null;
  const logs = useRows('focus_logs', { order: 'created_at', desc: true, limit: 10 });
  return (
    <div className="two-column">
      <Section title="Personal focus timer">
        <div className="timer-display">
          <Clock3 size={23} />
          <span>{phase?.phase || 'Ready'}</span>
          <strong>{phase ? clock(phase.remaining) : '25:00'}</strong>
          <p>
            {phase?.phase === 'Break'
              ? 'Stand up, stretch or rest your eyes.'
              : phase?.phase === 'Complete'
                ? 'Your focus block is complete.'
                : 'Set aside a block for one task.'}
          </p>
        </div>
        {!timer ? (
          <Form
            reset={false}
            onSubmit={(d) => {
              setTimer({
                started: new Date().toISOString(),
                study: Number(field(d, 'study')),
                pause: Number(field(d, 'pause')),
                subject: optional(d, 'subject'),
                logged: false,
              });
            }}
          >
            <SubjectSelect required={false} />
            <div className="form-grid">
              <Field
                label="Study minutes"
                name="study"
                type="number"
                defaultValue={25}
                min={1}
                max={120}
                required
              />
              <Field
                label="Break minutes"
                name="pause"
                type="number"
                defaultValue={5}
                min={1}
                max={30}
                required
              />
            </div>
            <Button className="primary" type="submit">
              <Play size={16} /> Start focus block
            </Button>
          </Form>
        ) : (
          <div className="button-row">
            {phase?.phase !== 'Focus' && (
              <Button
                className="primary"
                disabled={action.busy || timer.logged}
                onClick={() =>
                  void action.run(async () => {
                    await db.insert('focus_logs', {
                      user_id: user,
                      minutes: timer.study,
                      subject_id: timer.subject,
                    });
                    setTimer({ ...timer, logged: true });
                  }, 'Time recorded.')
                }
              >
                {timer.logged ? 'Time recorded' : 'Record study time'}
              </Button>
            )}
            <Button onClick={() => setTimer(null)}>
              {phase?.phase === 'Complete' ? 'New timer' : 'Reset timer'}
            </Button>
          </div>
        )}
        <Feedback {...action} />
      </Section>
      <Section title="Recorded focus blocks">
        <QueryState {...logs} />
        {logs.data.map((l) => (
          <div className="list-row" key={l.id}>
            <SubjectIcon subject={l.subject_id} />
            <span>
              <strong>{l.minutes} minutes</strong>
              <small>{dateLabel(l.created_at)}</small>
            </span>
          </div>
        ))}
        {!logs.loading && !logs.data.length && (
          <Empty
            icon={Timer}
            title="No recorded focus blocks"
            detail="Complete a focus interval to add it to your analytics."
          />
        )}
      </Section>
    </div>
  );
}
function Rooms({ room }: { room: string | null }) {
  const { user } = useWorkspace();
  const groups = useRows('study_groups', { order: 'created_at', desc: true });
  const membership = useRows('study_group_members', { where: { user_id: user } });
  if (room) return <Room id={room} />;
  const list = groups.data.filter((g) =>
    membership.data.some((m) => m.group_id === g.id && m.status === 'active'),
  );
  return (
    <Section
      title="Virtual study rooms"
      action={<ButtonLink to="/communities?tab=Groups">Browse groups</ButtonLink>}
    >
      <QueryState {...groups} />
      {list.map((g) => (
        <Link className="list-row" key={g.id} to={'/study?tab=Rooms&room=' + g.id}>
          <SubjectIcon subject={g.subject_id} />
          <span>
            <strong>{g.name}</strong>
            <small>{g.topic || g.category}</small>
          </span>
          <ChevronRight size={17} />
        </Link>
      ))}
      {!membership.loading && !list.length && (
        <Empty
          icon={Clock3}
          title="Your study rooms will appear here"
          detail="Create or join a study group to use its shared timer and task list."
        />
      )}
    </Section>
  );
}
function Room({ id }: { id: string }) {
  const { user, db } = useWorkspace();
  const action = useAction();
  const now = useNow();
  const [format, setFormat] = useState('25 / 5'),
    [clockOffset, setClockOffset] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const sample = async () => {
      const start = Date.now();
      try {
        const time = await db.rpc<string>('server_clock');
        if (!cancelled) setClockOffset(Date.parse(time) - (start + Date.now()) / 2);
      } catch (error) {
        console.warn(error);
      }
    };
    void sample();
    const interval = setInterval(sample, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [db]);
  const group = useRows('study_groups', { where: { id } });
  const room = useRows('study_rooms', { where: { id } });
  const members = useRows('study_room_participants', { where: { room_id: id } }, true);
  const timer = useRows(
    'study_timers',
    { where: { room_id: id }, order: 'started_at', desc: true, limit: 1 },
    true,
  );
  const tasks = useRows('room_tasks', { where: { room_id: id } }, true);
  const attendance = useRows('room_attendance');
  const conversation = useRows('conversations', { where: { id } });
  const me = members.data.find((p) => p.user_id === user),
    g = group.data[0],
    r = room.data[0],
    t = timer.data[0];
  const p = t
    ? timerPhase(t.started_at, t.study_minutes, t.break_minutes, now + clockOffset)
    : null;
  const recorded = attendance.data.some((a) => a.timer_id === t?.id);
  if (room.loading || !r)
    return (
      <>
        <QueryState {...room} />
        {!room.loading && (
          <Empty title="Room unavailable" detail="Join the study group to access its room." />
        )}
      </>
    );
  return (
    <>
      <Link className="text-link back-link" to="/study?tab=Rooms">
        <ArrowLeft size={16} /> Study rooms
      </Link>
      <div className="two-column">
        <Section
          title={g?.name || 'Study room'}
          action={
            <Button
              aria-pressed={!!me?.ready}
              onClick={() =>
                void action.run(
                  () => db.rpc('room_ready', { room: id, ready_state: !me?.ready }),
                  me?.ready ? 'Readiness cleared.' : 'You’re ready to study.',
                )
              }
            >
              {me?.ready ? 'Ready ✓' : 'Mark ready'}
            </Button>
          }
        >
          <p>{r.objective}</p>
          {r.scheduled_at && (
            <p className="fine-print">
              Scheduled for {dateLabel(r.scheduled_at, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
          <div className="timer-display">
            <Timer size={23} />
            <span>{p?.phase || 'Waiting to start'}</span>
            <strong>{p ? clock(p.remaining) : '00:00'}</strong>
            <p>
              {p?.phase === 'Break'
                ? 'Time for a break.'
                : p?.phase === 'Complete'
                  ? 'Shared focus session finished.'
                  : 'Everyone sees the same server-backed timer.'}
            </p>
          </div>
          {p && p.phase !== 'Focus' && (
            <Button
              className="primary"
              disabled={!me?.ready || recorded || action.busy}
              onClick={() =>
                void action.run(
                  () => db.rpc('log_room_attendance', { timer: t.id }),
                  'Attendance and study time recorded.',
                )
              }
            >
              {recorded ? 'Study time recorded' : 'Record attendance and study time'}
            </Button>
          )}
          {g?.owner_id === user && (!p || p.phase === 'Complete') && (
            <Form
              reset={false}
              onSubmit={(d) =>
                action.run(
                  () =>
                    db.rpc('start_timer', {
                      room: id,
                      study_length:
                        format === 'Custom'
                          ? Number(field(d, 'study'))
                          : format === '25 / 5'
                            ? 25
                            : 50,
                      break_length:
                        format === 'Custom'
                          ? Number(field(d, 'pause'))
                          : format === '25 / 5'
                            ? 5
                            : 10,
                    }),
                  'Shared timer started.',
                )
              }
            >
              <Select
                label="Session format"
                options={['25 / 5', '50 / 10', 'Custom']}
                value={format}
                onChange={setFormat}
              />
              {format === 'Custom' && (
                <div className="form-grid">
                  <Field
                    label="Study minutes"
                    type="number"
                    name="study"
                    min={1}
                    max={120}
                    defaultValue={25}
                    required
                  />
                  <Field
                    label="Break minutes"
                    type="number"
                    name="pause"
                    min={1}
                    max={30}
                    defaultValue={5}
                    required
                  />
                </div>
              )}
              <Button className="primary" type="submit" disabled={action.busy}>
                <Play size={16} /> Start shared timer
              </Button>
            </Form>
          )}
          {g?.owner_id === user && (
            <Disclosure label="Schedule or set objectives">
              <Form
                reset={false}
                onSubmit={(d) =>
                  action.run(
                    () =>
                      db.rpc('schedule_room', {
                        room: id,
                        objective_text: field(d, 'objective'),
                        starts: field(d, 'start')
                          ? new Date(field(d, 'start')).toISOString()
                          : null,
                      }),
                    'Room schedule saved.',
                  )
                }
              >
                <Field
                  label="Session objective"
                  name="objective"
                  defaultValue={r.objective}
                  required
                  maxLength={300}
                />
                <Field
                  label="Scheduled time"
                  type="datetime-local"
                  name="start"
                  defaultValue={
                    r.scheduled_at
                      ? new Date(
                          Date.parse(r.scheduled_at) -
                            new Date(r.scheduled_at).getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ''
                  }
                />
                <Button type="submit" disabled={action.busy}>
                  Save schedule
                </Button>
              </Form>
            </Disclosure>
          )}
          <Feedback {...action} />
        </Section>
        <Section title="Participants and tasks">
          <h3>Participants</h3>
          {members.data.map((m) => (
            <div className="list-row" key={m.user_id}>
              <Person id={m.user_id} />
              <span className={'chip ' + (m.ready ? 'success-chip' : '')}>
                {m.ready ? 'Ready' : 'In room'}
              </span>
            </div>
          ))}
          {!members.data.length && (
            <p className="muted">Participants appear when they set readiness.</p>
          )}
          <h3>Shared checklist</h3>
          {tasks.data.map((t) => (
            <label className="task-line" key={t.id}>
              <input
                type="checkbox"
                checked={t.done}
                onChange={() =>
                  void action.run(() =>
                    db.rpc('room_task', { room: id, task_id: t.id, completed: !t.done }),
                  )
                }
              />
              <span className={'task-box ' + (t.done ? 'done' : '')}>{t.done ? '✓' : ''}</span>
              <span>{t.title}</span>
            </label>
          ))}
          <Form
            onSubmit={(d) =>
              action.run(
                () => db.rpc('room_task', { room: id, task_title: field(d, 'task') }),
                'Shared task added.',
              )
            }
          >
            <Field label="New shared task" name="task" maxLength={150} required />
            <Button type="submit" disabled={action.busy}>
              Add shared task
            </Button>
          </Form>
        </Section>
      </div>
      {conversation.data[0] && <Chat conversation={conversation.data[0]} />}
    </>
  );
}
function ShareSelect() {
  const { user } = useWorkspace();
  const mine = useRows('community_members', { where: { user_id: user } });
  const communities = useRows('communities');
  return (
    <Select
      label="Share with a community"
      name="community"
      placeholder="Keep private"
      options={communities.data
        .filter((c) => mine.data.some((m) => m.community_id === c.id))
        .map((c) => ({ value: c.id!, label: c.name }))}
    />
  );
}
function Flashcards({ deck }: { deck: string | null }) {
  const { db, user } = useWorkspace();
  const action = useAction();
  const decks = useRows('flashcard_decks', { order: 'created_at', desc: true });
  const item = decks.data.find((d) => d.id === deck);
  if (deck)
    return item ? (
      <CardDeck key={deck} deck={item} />
    ) : (
      <>
        <QueryState {...decks} />
        {!decks.loading && <Empty title="Deck unavailable" />}
      </>
    );
  return (
    <div className="two-column">
      <Section title="Flashcard decks">
        <QueryState {...decks} />
        {decks.data.map((d) => (
          <Link className="list-row" key={d.id} to={'/study?tab=Flashcards&deck=' + d.id}>
            <SubjectIcon subject={d.subject_id} />
            <span>
              <strong>{d.title}</strong>
              <small>{d.community_id ? 'Community deck' : 'Personal deck'}</small>
            </span>
            <ChevronRight size={17} />
          </Link>
        ))}
        {!decks.loading && !decks.data.length && (
          <Empty
            icon={Layers}
            title="Build your first deck"
            detail="Create cards for concepts you want to recall."
          />
        )}
      </Section>
      <Section title="Create a flashcard deck">
        <Form
          onSubmit={(d) =>
            action.run(
              () =>
                db.insert('flashcard_decks', {
                  user_id: user,
                  title: field(d, 'title'),
                  subject_id: optional(d, 'subject'),
                  community_id: optional(d, 'community'),
                }),
              'Deck created.',
            )
          }
        >
          <Field label="Deck name" name="title" maxLength={100} required />
          <SubjectSelect required={false} />
          <ShareSelect />
          <Button className="primary" type="submit" disabled={action.busy}>
            Create deck
          </Button>
          <Feedback {...action} />
        </Form>
      </Section>
    </div>
  );
}
function CardDeck({ deck }: { deck: Row }) {
  const { db, user } = useWorkspace();
  const action = useAction();
  const cards = useRows('flashcards', { where: { deck_id: deck.id! } });
  const reviews = useRows('flashcard_reviews');
  const [index, setIndex] = useState(0),
    [flipped, flip] = useState(false),
    [dueOnly, setDueOnly] = useState(true);
  const ordered = cards.data.filter(
    (c) =>
      !dueOnly ||
      !(
        reviews.data
          .filter((r) => r.card_id === c.id)
          .sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))[0]?.next_review_at >
        new Date().toISOString()
      ),
  );
  const card = ordered[index % Math.max(1, ordered.length)];
  return (
    <>
      <Link className="text-link back-link" to="/study?tab=Flashcards">
        <ArrowLeft size={16} /> Flashcard decks
      </Link>
      <div className="two-column">
        <Section
          title={deck.title}
          action={
            <Button
              onClick={() => {
                setDueOnly(!dueOnly);
                setIndex(0);
                flip(false);
              }}
            >
              {dueOnly ? 'Practice all' : 'Due cards only'}
            </Button>
          }
        >
          <QueryState {...cards} />
          {card ? (
            <>
              <div className="flashcard">
                <span>
                  {flipped ? 'Answer' : 'Prompt'} · {(index % ordered.length) + 1} of{' '}
                  {ordered.length}
                </span>
                <RichText text={flipped ? card.back : card.front} />
              </div>
              <div className="button-row">
                <Button className="primary" onClick={() => flip(!flipped)}>
                  {flipped ? 'Show prompt' : 'Show answer'}
                </Button>
                <Button
                  onClick={() => {
                    setIndex(index + 1);
                    flip(false);
                  }}
                >
                  Next card
                </Button>
              </div>
              {flipped && (
                <div className="button-row">
                  {['Difficult', 'Medium', 'Easy'].map((level) => (
                    <Button
                      key={level}
                      disabled={action.busy}
                      onClick={() =>
                        void action.run(async () => {
                          await db.rpc('review_card', { card: card.id, rating: level });
                          flip(false);
                          if (!dueOnly) setIndex(index + 1);
                        }, 'Next review scheduled.')
                      }
                    >
                      {level}
                    </Button>
                  ))}
                </div>
              )}
            </>
          ) : (
            !cards.loading && (
              <Empty
                icon={Layers}
                title={cards.data.length ? 'All due cards reviewed' : 'This deck has no cards'}
                detail={
                  cards.data.length
                    ? 'Switch to Practice all if you want another pass.'
                    : 'Add a prompt and answer to begin.'
                }
              />
            )
          )}
          <Feedback {...action} />
        </Section>
        {deck.user_id === user && (
          <Section title="Add a flashcard">
            <Form
              onSubmit={(d) =>
                action.run(
                  () =>
                    db.insert('flashcards', {
                      deck_id: deck.id,
                      front: field(d, 'front'),
                      back: field(d, 'back'),
                    }),
                  'Flashcard added.',
                )
              }
            >
              <Area label="Prompt" name="front" required maxLength={1000} />
              <Area label="Answer" name="back" required maxLength={3000} />
              <Button className="primary" type="submit" disabled={action.busy}>
                Add card
              </Button>
            </Form>
          </Section>
        )}
      </div>
    </>
  );
}
function Quizzes({ quiz }: { quiz: string | null }) {
  const { db, user } = useWorkspace();
  const action = useAction();
  const list = useRows('quizzes', { order: 'created_at', desc: true });
  const item = list.data.find((q) => q.id === quiz);
  if (quiz)
    return item ? (
      <Quiz key={quiz} quiz={item} />
    ) : (
      <>
        <QueryState {...list} />
        {!list.loading && <Empty title="Quiz unavailable" />}
      </>
    );
  return (
    <div className="two-column">
      <Section title="Practice quizzes">
        <QueryState {...list} />
        {list.data.map((q) => (
          <Link className="list-row" key={q.id} to={'/study?tab=Quizzes&quiz=' + q.id}>
            <SubjectIcon subject={q.subject_id} />
            <span>
              <strong>{q.title}</strong>
              <small>{q.community_id ? 'Community quiz' : 'Personal quiz'}</small>
            </span>
            <ChevronRight size={17} />
          </Link>
        ))}
        {!list.loading && !list.data.length && (
          <Empty
            icon={ListChecks}
            title="No quizzes yet"
            detail="Create a multiple-choice quiz or join a community that has shared one."
          />
        )}
      </Section>
      <Section title="Create a quiz">
        <Form
          onSubmit={(d) =>
            action.run(
              () =>
                db.insert('quizzes', {
                  user_id: user,
                  title: field(d, 'title'),
                  subject_id: optional(d, 'subject'),
                  community_id: optional(d, 'community'),
                }),
              'Quiz created.',
            )
          }
        >
          <Field label="Quiz title" name="title" required maxLength={100} />
          <SubjectSelect required={false} />
          <ShareSelect />
          <Button className="primary" type="submit" disabled={action.busy}>
            Create quiz
          </Button>
          <Feedback {...action} />
        </Form>
      </Section>
    </div>
  );
}
function Quiz({ quiz }: { quiz: Row }) {
  const { db, user } = useWorkspace();
  const action = useAction();
  const items = useRows('quiz_questions', { where: { quiz_id: quiz.id! }, order: 'position' });
  const attempts = useRows('quiz_attempts', {
    where: { quiz_id: quiz.id! },
    order: 'created_at',
    desc: true,
  });
  const [result, setResult] = useState<string | null>(null);
  const answer = attempts.data.find((r) => r.id === result);
  return (
    <>
      <Link className="text-link back-link" to="/study?tab=Quizzes">
        <ArrowLeft size={16} /> Practice quizzes
      </Link>
      <Section title={quiz.title}>
        <QueryState {...items} />
        {answer ? (
          <div className="quiz-results">
            <h3>
              Result · {answer.score} / {answer.total}
            </h3>
            {answer.results.map((r: Row, i: number) => (
              <div className="comment" key={i}>
                <strong>{r.prompt}</strong>
                <p>{r.ok ? 'Correct' : 'Your answer: ' + r.chosen + ' · Correct: ' + r.correct}</p>
                <RichText text={r.explanation} />
              </div>
            ))}
            <Button onClick={() => setResult(null)}>Practice again</Button>
          </div>
        ) : items.data.length > 0 ? (
          <Form
            onSubmit={(d) =>
              action.run(
                async () =>
                  setResult(
                    await db.rpc<string>('grade_quiz', {
                      quiz: quiz.id,
                      selections: Object.fromEntries(
                        items.data.map((q) => [q.id, Number(field(d, q.id!))]),
                      ),
                    }),
                  ),
                'Quiz graded.',
              )
            }
          >
            {items.data.map((q) => (
              <fieldset className="quiz-item" key={q.id}>
                <legend>
                  <RichText text={q.prompt} />
                </legend>
                {q.options.map((option: string, i: number) => (
                  <label className="check" key={i}>
                    <input type="radio" name={q.id} value={i} required />
                    {option}
                  </label>
                ))}
              </fieldset>
            ))}
            <Button type="submit" className="primary" disabled={action.busy}>
              Check answers
            </Button>
          </Form>
        ) : (
          !items.loading && <Empty icon={ListChecks} title="No questions yet" />
        )}
        <Feedback {...action} />
        {attempts.data.length > 0 && (
          <Disclosure label="Past attempts">
            {attempts.data.map((a) => (
              <div className="list-row" key={a.id}>
                <span>
                  {dateLabel(a.created_at)} · {a.score} / {a.total}
                </span>
                <Button onClick={() => setResult(a.id!)}>Review</Button>
              </div>
            ))}
          </Disclosure>
        )}
      </Section>
      {quiz.user_id === user && (
        <Section title="Add a question">
          <Form
            onSubmit={(d) =>
              action.run(
                () =>
                  db.rpc('add_quiz_item', {
                    quiz: quiz.id,
                    prompt_text: field(d, 'prompt'),
                    choices: [1, 2, 3, 4].map((i) => field(d, 'option' + i)),
                    correct: Number(field(d, 'correct')) - 1,
                    explanation_text: field(d, 'explanation'),
                  }),
                'Question added.',
              )
            }
          >
            <Area label="Question" name="prompt" required maxLength={2000} />
            <div className="form-grid">
              {[1, 2, 3, 4].map((i) => (
                <Field key={i} label={'Option ' + i} name={'option' + i} required maxLength={300} />
              ))}
            </div>
            <Select label="Correct option" name="correct" options={['1', '2', '3', '4']} />
            <Area label="Answer explanation" name="explanation" required maxLength={3000} />
            <Button className="primary" type="submit" disabled={action.busy}>
              Add quiz question
            </Button>
          </Form>
        </Section>
      )}
    </>
  );
}
function Exams() {
  const { db, user } = useWorkspace();
  const action = useAction();
  const exams = useRows('examinations', { order: 'exam_on' });
  return (
    <div className="two-column">
      <Section title="Exam preparation">
        <QueryState {...exams} />
        {exams.data.map((e) => (
          <Exam key={e.id} exam={e} />
        ))}
        {!exams.loading && !exams.data.length && (
          <Empty
            icon={CalendarDays}
            title="No exams on your calendar"
            detail="Add a date to start a countdown and a revision checklist."
          />
        )}
      </Section>
      <Section title="Add an exam">
        <Form
          onSubmit={(d) =>
            action.run(
              () =>
                db.insert('examinations', {
                  user_id: user,
                  title: field(d, 'title'),
                  exam_on: field(d, 'date'),
                  subject_id: optional(d, 'subject'),
                }),
              'Exam added.',
            )
          }
        >
          <Field label="Exam name" name="title" required maxLength={140} />
          <SubjectSelect required={false} />
          <Field label="Exam date" name="date" type="date" required />
          <Button type="submit" className="primary" disabled={action.busy}>
            Save exam
          </Button>
          <Feedback {...action} />
        </Form>
        <p className="fine-print">
          <BookOpen size={16} /> Prepare with concept review and original practice questions.
        </p>
      </Section>
    </div>
  );
}
function Exam({ exam }: { exam: Row }) {
  const { db, user } = useWorkspace();
  const action = useAction();
  const topics = useRows('exam_topics', { where: { exam_id: exam.id! } });
  const days = deltaDays(exam.exam_on);
  return (
    <Disclosure
      label={
        exam.title +
        ' · ' +
        (days === 0 ? 'Today' : days > 0 ? days + ' days to go' : dateLabel(exam.exam_on))
      }
    >
      <div className="button-row">
        <ButtonLink to="/study?tab=Planner">Plan revisions</ButtonLink>
        <ButtonLink to="/study?tab=Quizzes">Practice quizzes</ButtonLink>
        <ButtonLink to="/communities?tab=Groups">Revision groups</ButtonLink>
      </div>
      <h3>Revision checklist</h3>
      {topics.data.map((t) => (
        <label className="list-row" key={t.id}>
          <input
            aria-label={'Complete ' + t.title}
            type="checkbox"
            checked={t.done}
            onChange={() =>
              void action.run(() => db.update('exam_topics', { id: t.id! }, { done: !t.done }))
            }
          />
          {t.title}
        </label>
      ))}
      <Form
        onSubmit={(d) =>
          action.run(
            () =>
              db.insert('exam_topics', {
                user_id: user,
                exam_id: exam.id,
                title: field(d, 'topic'),
              }),
            'Topic added.',
          )
        }
      >
        <Field label="Revision topic" name="topic" required maxLength={140} />
        <Button type="submit" disabled={action.busy}>
          Add topic
        </Button>
      </Form>
      <Form
        reset={false}
        onSubmit={(d) =>
          action.run(
            () =>
              db.update(
                'examinations',
                { id: exam.id! },
                {
                  formulas: optional(d, 'formulas'),
                  mock_score: field(d, 'score') ? Number(field(d, 'score')) : null,
                },
              ),
            'Exam notes saved.',
          )
        }
      >
        <Area
          label="Formula collection"
          name="formulas"
          defaultValue={exam.formulas || ''}
          maxLength={5000}
        />
        <Field
          label="Mock exam score (%)"
          name="score"
          type="number"
          min={0}
          max={100}
          defaultValue={exam.mock_score ?? ''}
        />
        <Button type="submit" disabled={action.busy}>
          Save exam notes
        </Button>
        <Feedback {...action} />
      </Form>
    </Disclosure>
  );
}
