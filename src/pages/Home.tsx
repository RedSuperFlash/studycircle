import {
  ArrowDownRight,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CircleHelp,
  Clock3,
  HandHeart,
  MapPin,
  MessageCircle,
  Orbit,
  Plus,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ButtonLink,
  Empty,
  Feedback,
  QueryState,
  Section,
  SubjectIcon,
  TextLink,
} from '../components/ui';
import { useAction, useRows, useRPC, useWorkspace } from '../hooks/workspace';
import { dateLabel, deltaDays, isoDay } from '../lib/format';
import { MetricChart, weekSeries } from '../components/Charts';
import type { Row } from '../types';

function ShieldIcon() {
  return <BookOpen size={16} />;
}
function OrbitalArt() {
  return (
    <div className="orbital-art" aria-hidden="true">
      <svg viewBox="0 0 415 240" fill="none">
        <defs>
          <radialGradient id="orbit-fill">
            <stop stopColor="#a5a1ff" stopOpacity=".24" />
            <stop offset="1" stopColor="#a5a1ff" stopOpacity="0" />
          </radialGradient>
          <pattern id="dots" width="17" height="17" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#d8dcff" opacity=".30" />
          </pattern>
        </defs>
        <circle cx="260" cy="120" r="136" fill="url(#orbit-fill)" />
        <path d="M140 0H415V240H140z" fill="url(#dots)" opacity=".55" />
        <g stroke="#d4d2ff" strokeOpacity=".40">
          <ellipse cx="256" cy="119" rx="139" ry="54" transform="rotate(-23 256 119)" />
          <ellipse cx="256" cy="119" rx="139" ry="54" transform="rotate(25 256 119)" />
          <circle cx="256" cy="119" r="83" strokeDasharray="3 6" />
          <circle cx="256" cy="119" r="55" strokeOpacity=".65" />
          <circle cx="256" cy="119" r="110" strokeOpacity=".22" />
        </g>
        <path
          d="M256 143c-10-11-22-15-38-15V94c16 0 28 6 38 17 10-11 22-17 38-17v34c-16 0-28 4-38 15Zm0-32v32"
          stroke="#f4f2ff"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="358" cy="55" r="9" fill="#b1f5df" />
        <circle cx="160" cy="153" r="6" fill="#c4bdff" />
        <circle cx="354" cy="171" r="5" fill="#d9d6ff" />
        <circle cx="230" cy="39" r="3" fill="#b1f5df" />
        <path
          d="M311 35v14m-7-7h14M139 76v14m-7-7h14M387 129v14m-7-7h14"
          stroke="#e1e2ff"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
export function Home() {
  const { db, user, demo } = useWorkspace(),
    reduce = useReducedMotion(),
    action = useAction();
  const profile = useRows('profiles', { where: { id: user } });
  const tasks = useRows('study_tasks', { order: 'due_on' });
  const exams = useRows('examinations', { order: 'exam_on' });
  const metrics = useRPC<Row>('my_analytics', undefined, {});
  const questions = useRows('questions', { order: 'created_at', desc: true, limit: 3 });
  const communities = useRows('communities', { limit: 5 });
  const settings = useRows('app_settings');
  const requests = useRows('study_requests', { limit: 30 }, true);
  const sessions = useRows('study_sessions', { limit: 30 }, true);
  const goals = useRows('study_goals', { limit: 3 });
  const who = profile.data[0];
  const name = (who?.display_name || who?.alias || 'student').split(' ')[0];
  const todayTasks = tasks.data.filter((t) => t.due_on === isoDay() || (!t.due_on && !t.done));
  const count = todayTasks.filter((t) => t.done).length;
  const soon = exams.data.filter((e) => deltaDays(e.exam_on) >= 0).slice(0, 3);
  const activity = weekSeries(metrics.data.activity || []);
  const weekly = activity.reduce((total, d) => total + d.value, 0);
  return (
    <div className="dashboard">
      {settings.data.find((x) => x.key === 'announcement') && (
        <p className="inline-note">{settings.data.find((x) => x.key === 'announcement')?.value}</p>
      )}
      {settings.data.find((x) => x.key === 'guidelines_summary') && (
        <p className="inline-note">
          <ShieldIcon />
          {settings.data.find((x) => x.key === 'guidelines_summary')?.value}{' '}
          <Link to="/overview#guidelines">Community guidelines</Link>
        </p>
      )}
      <div className="home-heading">
        <div>
          <p className="today-line">
            <CalendarDays size={15} />
            {dateLabel(isoDay(), { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1>Good to see you, {name}.</h1>
          <p>Pick up where you left off or find someone to study with.</p>
        </div>
        <ButtonLink to="/study?tab=Planner&compose=1">
          <Plus size={17} /> New study task
        </ButtonLink>
      </div>
      <motion.section
        className="home-hero"
        initial={reduce ? false : { opacity: 0.8, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <OrbitalArt />
        <div className="hero-copy">
          <span className="hero-icon">
            <Orbit size={22} />
          </span>
          <h2>
            Learn together.
            <br />
            Grow together.
          </h2>
          <p>Work through difficult topics with students who can help, and share what you know.</p>
          <Link className="button hero-action" to="/connect">
            <UsersRound size={17} /> Find a study partner <ArrowRight size={17} />
          </Link>
        </div>
      </motion.section>
      <div className="quick-links" aria-label="Study shortcuts">
        <Link to="/connect?intent=Get+help">
          <span className="quick-icon purple">
            <CircleHelp size={19} />
          </span>
          <span>
            <strong>Get help now</strong>
            <small>Work through a topic</small>
          </span>
          <ArrowDownRight size={17} />
        </Link>
        <Link to="/connect?intent=Offer+help">
          <span className="quick-icon green">
            <HandHeart size={19} />
          </span>
          <span>
            <strong>Help another student</strong>
            <small>Share what you know</small>
          </span>
          <ArrowDownRight size={17} />
        </Link>
        <Link to="/connect?scope=city">
          <span className="quick-icon amber">
            <MapPin size={19} />
          </span>
          <span>
            <strong>Find someone nearby</strong>
            <small>Explore your local circle</small>
          </span>
          <ArrowDownRight size={17} />
        </Link>
      </div>
      <div className="dashboard-grid">
        <Section
          title="Study activity"
          action={<TextLink to="/profile?tab=Progress">View progress</TextLink>}
          className="activity-panel"
        >
          <QueryState loading={metrics.loading} error={metrics.error} />
          <div className="activity-meta">
            <div>
              <span className="activity-number">
                {weekly >= 60 ? Math.floor(weekly / 60) + 'h ' : ''}
                {weekly % 60}m
              </span>
              <p>Focus time in the last 7 days</p>
            </div>
            <span className="chip">
              <Clock3 size={13} /> Last 7 days
            </span>
          </div>
          <MetricChart data={activity} />
        </Section>
        <Section title="Today’s plan" action={<TextLink to="/study">Planner</TextLink>}>
          <QueryState {...tasks} />
          <Feedback {...action} />
          <div className="plan-summary">
            <span>
              {count} of {todayTasks.length} tasks complete
            </span>
            <progress max={todayTasks.length || 1} value={count} />
          </div>
          {todayTasks.length
            ? todayTasks.slice(0, 4).map((t) => (
                <label className="task-line" key={t.id}>
                  <input
                    type="checkbox"
                    checked={t.done}
                    disabled={action.busy}
                    onChange={() =>
                      void action.run(() =>
                        db.update('study_tasks', { id: t.id! }, { done: !t.done }),
                      )
                    }
                  />
                  <span className={'task-box ' + (t.done ? 'done' : '')}>
                    {t.done && <Check size={13} />}
                  </span>
                  <span>
                    <strong>{t.title}</strong>
                    <small>
                      {t.kind}
                      {t.priority === 'High' ? ' · High priority' : ''}
                    </small>
                  </span>
                </label>
              ))
            : !tasks.loading && (
                <Empty title="A clear day" detail="Add a task to plan your next study block." />
              )}
          {goals.data.length > 0 && (
            <Link className="goal-link" to="/study?tab=Goals">
              <strong>Current goal</strong>
              <span>{goals.data[0].title}</span>
              <ArrowRight size={15} />
            </Link>
          )}
        </Section>
        <Section
          title="Recent questions"
          action={<TextLink to="/communities?tab=Questions">Browse Q&A</TextLink>}
        >
          <QueryState {...questions} />
          {questions.data.map((q) => (
            <Link
              className="list-row"
              key={q.id}
              to={'/communities?tab=Questions&question=' + q.id}
            >
              <SubjectIcon subject={q.subject_id} />
              <span>
                <strong>{q.title}</strong>
                <small>{q.topic || 'Academic discussion'}</small>
              </span>
              <span className="reply-count">
                <MessageCircle size={14} />
                {q.answer_count}
              </span>
            </Link>
          ))}
          {!questions.loading && !questions.data.length && (
            <Empty
              title="No questions yet"
              detail="Ask a question about a topic you’re learning."
            />
          )}
        </Section>
        <Section title="Coming up" action={<TextLink to="/study?tab=Exams">View exams</TextLink>}>
          <QueryState {...exams} />
          {soon.map((e) => (
            <div className="list-row" key={e.id}>
              <div className="date-box">
                <small>{dateLabel(e.exam_on, { month: 'short' })}</small>
                <strong>{dateLabel(e.exam_on, { day: 'numeric' })}</strong>
              </div>
              <span>
                <strong>{e.title}</strong>
                <small>
                  {deltaDays(e.exam_on) === 0 ? 'Today' : deltaDays(e.exam_on) + ' days to go'}
                </small>
              </span>
            </div>
          ))}
          {sessions.data
            .filter((s) => !s.completed_at)
            .slice(0, 2)
            .map((s) => (
              <Link className="list-row" to={'/connect?tab=Messages&chat=' + s.id} key={s.id}>
                <SubjectIcon subject={s.subject_id} />
                <span>
                  <strong>Peer study session</strong>
                  <small>Open your conversation</small>
                </span>
              </Link>
            ))}
          {!soon.length && !exams.loading && (
            <Empty
              title="No upcoming exams"
              detail="Add an exam date to start your countdown."
              icon={CalendarDays}
            />
          )}
          {requests.data.some((r) => r.recipient_id === user && r.status === 'pending') && (
            <TextLink to="/connect?tab=Requests">Review pending requests</TextLink>
          )}
        </Section>
        <Section
          title="Explore communities"
          action={<TextLink to="/communities">All communities</TextLink>}
          className="wide"
        >
          <div className="community-strip">
            {communities.data.slice(0, 3).map((c) => (
              <Link key={c.id} to={'/communities?community=' + c.id}>
                <SubjectIcon subject={c.id} />
                <span>
                  <strong>{c.name}</strong>
                  <small>{c.category}</small>
                </span>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
          {demo && (
            <p className="fine-print">
              <BookOpen size={14} /> Classroom activity is fictional and resets on refresh.
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
