import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  Check,
  Clock3,
  Compass,
  MapPin,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  ShieldCheck,
  UserRoundMinus,
  UsersRound,
} from 'lucide-react';
import {
  Area,
  Avatar,
  Button,
  ButtonLink,
  Check as Checkbox,
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
  fileFrom,
  optional,
  optionsFrom,
} from '../components/ui';
import { Attachment, Report } from '../components/Safety';
import { useAction, useRows, useRPC, useWorkspace } from '../hooks/workspace';
import { attachmentAccept } from '../services/live';
import { dateLabel } from '../lib/format';
import type { Row } from '../types';

const intents = [
  'Get help',
  'Offer help',
  'Study partner',
  'Exam prep',
  'Group study',
  'Accountability',
  'Topic revision',
];
export const availability = ['Weekday mornings', 'Weekday evenings', 'Weekends'];
const scopes = [
  { value: 'worldwide', label: 'Worldwide' },
  { value: 'online', label: 'Online only' },
  { value: 'institution', label: 'Same institution / college' },
  { value: 'residential', label: 'Same residential community' },
  { value: 'neighbourhood', label: 'Same neighbourhood' },
  { value: 'locality', label: 'Same locality' },
  { value: 'city', label: 'Same city' },
  { value: 'district', label: 'Same district' },
  { value: 'state', label: 'Same state' },
  { value: 'country', label: 'Same country' },
  ...[2, 5, 10, 25, 50].map((n) => ({
    value: 'radius-' + n,
    label: 'Approximate ' + n + ' km preference',
  })),
];
const tabs = ['Find partners', 'Requests', 'Messages', 'Accountability'];
export default function Connect() {
  const [params] = useSearchParams();
  const tab = params.get('tab') || tabs[0];
  return (
    <>
      <PageTitle
        title="Connect"
        detail="Find students who can help you get unstuck or make progress together."
      />
      <Tabs labels={tabs} />
      {tab === 'Requests' ? (
        <Requests />
      ) : tab === 'Messages' ? (
        <Messages chat={params.get('chat')} />
      ) : tab === 'Accountability' ? (
        <Partnerships />
      ) : (
        <Matchmaking intent={params.get('intent')} initialScope={params.get('scope')} />
      )}
    </>
  );
}
function Matchmaking({
  intent,
  initialScope,
}: {
  intent: string | null;
  initialScope: string | null;
}) {
  const { db, user } = useWorkspace();
  const action = useAction(),
    request = useAction();
  const queue = useRows('matchmaking_queue', { where: { user_id: user } });
  const activeSearch = queue.data[0];
  const levels = useRows('education_levels', { order: 'name' });
  const [subject, setSubject] = useState(''),
    [scope, setScope] = useState(initialScope || 'worldwide'),
    [searched, setSearched] = useState(false);
  const topics = useRows('topics', subject ? { where: { subject_id: subject } } : undefined);
  const [partners, setPartners] = useState<Row[]>([]),
    [sent, setSent] = useState<string[]>([]),
    [lookup, setLookup] = useState({ subject: '', intent: '' });
  useEffect(() => {
    setScope(initialScope || 'worldwide');
  }, [initialScope]);
  return (
    <div className="two-column finder">
      <Section title="Set your study preferences">
        <Form
          key={intent}
          reset={false}
          onSubmit={(d) =>
            action.run(async () => {
              const requestArgs = {
                subject: field(d, 'subject'),
                intent: field(d, 'intent'),
                topic: optional(d, 'topic'),
                level: optional(d, 'level'),
                preferred_language: optional(d, 'language'),
                slot: optional(d, 'slot'),
                duration: Number(field(d, 'duration')),
                scope,
                group_study: d.has('group'),
              };
              setSearched(false);
              setPartners([]);
              setPartners(await db.rpc('find_partners', requestArgs));
              setLookup({ subject: requestArgs.subject, intent: requestArgs.intent });
              setSearched(true);
            })
          }
        >
          <Select
            label="What would you like to do?"
            name="intent"
            options={intents}
            defaultValue={intents.includes(intent || '') ? intent! : intents[0]}
          />
          <SubjectSelect value={subject} onChange={setSubject} />
          <label className="field">
            <span>Topic</span>
            <input
              name="topic"
              list="study-topics"
              maxLength={100}
              placeholder="e.g. Eigenvalues and eigenvectors"
            />
            <datalist id="study-topics">
              {topics.data.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
          </label>
          <div className="form-grid">
            <Select
              name="level"
              label="Education level"
              placeholder="Any level"
              options={optionsFrom(levels.data)}
            />
            <Field
              label="Preferred language"
              name="language"
              defaultValue="English"
              maxLength={35}
            />
            <Select
              name="slot"
              label="Availability"
              options={availability}
              placeholder="Any time"
            />
            <Select
              name="duration"
              label="Study duration (minutes)"
              options={['25', '50', '60', '90', '120']}
              defaultValue="50"
            />
          </div>
          <Select
            label="Discovery area"
            name="scope"
            options={scopes}
            value={scope}
            onChange={setScope}
          />
          {!['online', 'worldwide'].includes(scope) && (
            <p className="inline-note">
              <MapPin size={17} /> Local search uses opt-in area cohorts with a minimum size. A
              radius selection maps to a region, with no individual distance displayed.{' '}
              <Link to="/profile?tab=Privacy">Set your area</Link>.
            </p>
          )}
          <Checkbox name="group">I’m open to group study</Checkbox>
          {activeSearch && (
            <div className="inline-note">
              <Clock3 size={15} /> Your preferences are saved in the matchmaking queue.{' '}
              <Button
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await db.remove('matchmaking_queue', { user_id: user });
                    setPartners([]);
                    setSearched(false);
                  }, 'Search preferences cleared.')
                }
              >
                Clear search
              </Button>
            </div>
          )}
          <Button type="submit" className="primary" disabled={action.busy}>
            <Search size={17} /> {action.busy ? 'Searching…' : 'Find study partners'}
          </Button>
          <Feedback {...action} />
        </Form>
      </Section>
      <Section title="Recommended partners">
        <Feedback {...request} />
        {!searched && !action.busy && (
          <Empty
            icon={Compass}
            title="Start with a subject"
            detail="We’ll show what you have in common with each recommendation."
          />
        )}
        {action.busy && <QueryState loading />}
        {searched && !partners.length && (
          <Empty
            icon={UsersRound}
            title="No suitable partners yet"
            detail="Try another subject or search worldwide. Local results appear only when there are enough eligible students."
          />
        )}
        {partners.map((p) => (
          <article className="match-card" key={p.id}>
            <div className="match-head">
              <Avatar name={p.name} tone={p.avatar} size="large" />
              <div>
                <h3>{p.name}</h3>
                <span className="chip success-chip">{p.score} / 100 compatibility</span>
              </div>
            </div>
            <ul className="reason-list">
              {p.reasons.map((r: string) => (
                <li key={r}>
                  <Check size={15} />
                  {r}
                </li>
              ))}
            </ul>
            <Button
              className="primary"
              disabled={request.busy || sent.includes(p.id!)}
              onClick={() =>
                void request.run(async () => {
                  await db.rpc('send_request', {
                    target: p.id,
                    subject: lookup.subject,
                    purpose: lookup.intent,
                  });
                  setSent((prev) => [...prev, p.id!]);
                }, 'Study request sent.')
              }
            >
              <Send size={15} />
              {sent.includes(p.id!) ? 'Request sent' : 'Send study request'}
            </Button>
            <Disclosure label="View shared profile">
              <SharedProfile id={p.id!} />
            </Disclosure>
            <Report kind="user" item={p.id!} />
          </article>
        ))}
        <p className="fine-print">
          <ShieldCheck size={16} /> Meet in a public study space if you decide to study in person.
        </p>
      </Section>
    </div>
  );
}
function SharedProfile({ id }: { id: string }) {
  const { db, user } = useWorkspace();
  const action = useAction();
  const person = useRPC<Row[]>('person', { person_id: id }, []);
  const levels = useRows('education_levels'),
    institutions = useRows('institutions');
  const profile = person.data[0];
  return (
    <>
      <QueryState {...person} />
      {profile ? (
        <>
          <h3>{profile.name}</h3>
          {profile.bio && <p>{profile.bio}</p>}
          <p className="fine-print">
            {[
              levels.data.find((row) => row.id === profile.education_id)?.name,
              institutions.data.find((row) => row.id === profile.institution_id)?.name,
            ]
              .filter(Boolean)
              .join(' · ') || 'Limited public student profile'}
          </p>
          <Button
            onClick={() =>
              void action.run(
                () => db.insert('blocked_users', { owner_id: user, blocked_id: id }),
                'Student blocked.',
              )
            }
            disabled={action.busy}
          >
            <UserRoundMinus size={15} /> Block student
          </Button>
        </>
      ) : (
        !person.loading && <Empty title="Profile unavailable" />
      )}
      <Feedback {...action} />
    </>
  );
}
function Requests() {
  const { user, db } = useWorkspace();
  const requests = useRows('study_requests', { order: 'created_at', desc: true }, true);
  const subjects = useRows('subjects');
  const sessions = useRows('study_sessions', undefined, true);
  const action = useAction();
  const [, setParams] = useSearchParams();
  const list = (incoming: boolean) =>
    requests.data.filter((r) => (incoming ? r.recipient_id : r.sender_id) === user);
  const respond = (id: string, decision: string) =>
    action.run(
      async () => {
        const session = await db.rpc<string | null>('respond_request', { request: id, decision });
        if (session) setParams({ tab: 'Messages', chat: session });
      },
      decision === 'accepted' ? 'Study request accepted.' : 'Study request updated.',
    );
  return (
    <>
      <Feedback {...action} />
      <div className="two-column">
        {[true, false].map((incoming) => (
          <Section key={String(incoming)} title={incoming ? 'Received' : 'Sent'}>
            <QueryState {...requests} />
            {list(incoming).map((r) => {
              const s = sessions.data.find((s) => s.request_id === r.id);
              return (
                <div className="request-card" key={r.id}>
                  <div className="list-row">
                    <SubjectIcon subject={r.subject_id} />
                    <span>
                      <strong>
                        <Person id={incoming ? r.sender_id : r.recipient_id} />
                      </strong>
                      <small>
                        {subjects.data.find((x) => x.id === r.subject_id)?.name} · {r.intent}
                      </small>
                    </span>
                    <span className={'chip ' + (r.status === 'accepted' ? 'success-chip' : '')}>
                      {r.status}
                    </span>
                  </div>
                  {r.status === 'pending' && (
                    <div className="button-row">
                      {incoming ? (
                        <>
                          <Button
                            className="primary"
                            disabled={action.busy}
                            onClick={() => void respond(r.id!, 'accepted')}
                          >
                            Accept request
                          </Button>
                          <Button
                            onClick={() => void respond(r.id!, 'declined')}
                            disabled={action.busy}
                          >
                            Decline
                          </Button>
                        </>
                      ) : (
                        <Button
                          disabled={action.busy}
                          onClick={() => void respond(r.id!, 'cancelled')}
                        >
                          Cancel request
                        </Button>
                      )}
                    </div>
                  )}
                  {s && (
                    <ButtonLink to={'/connect?tab=Messages&chat=' + s.id}>
                      Open conversation <ArrowRight size={15} />
                    </ButtonLink>
                  )}
                </div>
              );
            })}
            {!requests.loading && !list(incoming).length && (
              <Empty
                title={incoming ? 'No incoming requests' : 'No sent requests'}
                detail={
                  incoming
                    ? 'Requests from other students will appear here.'
                    : 'Find a study partner to send an invitation.'
                }
              />
            )}
          </Section>
        ))}
      </div>
    </>
  );
}
function Messages({ chat }: { chat: string | null }) {
  const { user, db } = useWorkspace();
  const conversations = useRows('conversations', { order: 'created_at', desc: true });
  const { data, loading, error } = conversations;
  const unread = useRows('chat_unread', { where: { user_id: user } });
  useEffect(() => db.subscribe('messages', unread.reload), [db]);
  useEffect(() => db.subscribe('conversations', conversations.reload), [db]);
  const selected = data.find((r) => r.id === chat);
  return (
    <div className="two-column chat-layout">
      <Section title="Conversations">
        <QueryState loading={loading} error={error} />
        {data.map((c) => (
          <Link
            className={'list-row chat-option ' + (chat === c.id ? 'selected' : '')}
            key={c.id}
            to={'/connect?tab=Messages&chat=' + c.id}
          >
            <span className="subject-icon">
              <MessageCircle size={18} />
            </span>
            <span>
              <strong>{c.title}</strong>
              <small>{c.session_id ? 'Accepted study request' : 'Study group'}</small>
            </span>
            {!!unread.data.find((row) => row.conversation_id === c.id && row.unread > 0) && (
              <span className="chip">
                {unread.data.find((row) => row.conversation_id === c.id)?.unread}
              </span>
            )}
          </Link>
        ))}
        {!loading && !data.length && (
          <Empty
            title="No conversations yet"
            detail="Accept a study request or join a group to start chatting."
          />
        )}
      </Section>
      {selected ? (
        <Chat key={selected.id} conversation={selected} />
      ) : (
        <Section title="Messages">
          <Empty
            icon={MessageCircle}
            title="Choose a conversation"
            detail="Your history appears here when you open a conversation."
          />
        </Section>
      )}
    </div>
  );
}
export function Chat({ conversation }: { conversation: Row }) {
  const chat = conversation.id!;
  const { user, db, demo } = useWorkspace();
  const action = useAction();
  const end = useAction();
  const [reply, setReply] = useState<Row | null>(null);
  const [completion, setCompletion] = useState('');
  const members = useRows('conversation_participants', { where: { conversation_id: chat } });
  const messages = useRows(
    'messages',
    { where: { conversation_id: chat }, order: 'created_at', desc: true, limit: 100 },
    true,
  );
  const files = useRows('message_attachments', undefined, true);
  const sessions = useRows(
    'study_sessions',
    conversation.session_id ? { where: { id: conversation.session_id } } : undefined,
    true,
  );
  const eligible = useRows('review_eligibility');
  const presence = useRows('chat_presence', { where: { conversation_id: chat } }, true);
  const [now, setNow] = useState(Date.now()),
    [limit, setLimit] = useState(false);
  const lastTyping = useRef(0);
  const oldMessages = useRows(
    'messages',
    limit
      ? { where: { conversation_id: chat }, order: 'created_at', desc: true, limit: 500 }
      : { where: { id: chat } },
  );
  const own = members.data.find((p) => p.user_id === user);
  const peer = conversation.session_id ? members.data.find((p) => p.user_id !== user) : undefined;
  const session = sessions.data.find((s) => s.id === conversation.session_id),
    entitlement = eligible.data.find((r) => r.session_id === session?.id);
  const latest = messages.data[0]?.created_at;
  useEffect(() => {
    if (latest && own && (!own.last_read_at || Date.parse(own.last_read_at) < Date.parse(latest)))
      void db
        .update(
          'conversation_participants',
          { conversation_id: chat, user_id: user },
          { last_read_at: new Date().toISOString() },
        )
        .catch(console.warn);
  }, [db, chat, user, latest, own?.last_read_at]);
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === 'visible')
        void db.rpc('chat_signal', { chat, typing: false }).catch(console.warn);
    };
    ping();
    const id = setInterval(ping, 25000),
      tick = setInterval(() => setNow(Date.now()), 1000),
      refresh = setInterval(messages.reload, 15000);
    return () => {
      clearInterval(id);
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [db, chat]);
  const typing = presence.data.some(
    (p) => p.user_id !== user && Date.parse(p.typing_at) > now - 5000,
  );
  const online = presence.data.filter(
    (p) => p.user_id !== user && Date.parse(p.seen_at) > now - 40000,
  ).length;
  const write = () => {
    if (Date.now() - lastTyping.current > 1800) {
      lastTyping.current = Date.now();
      void db.rpc('chat_signal', { chat, typing: true }).catch(console.warn);
    }
  };
  const history =
    limit && oldMessages.data.length > messages.data.length ? oldMessages.data : messages.data;
  return (
    <Section
      title={conversation.title}
      action={
        own && (
          <Button
            onClick={() =>
              void end.run(
                () =>
                  db.update(
                    'conversation_participants',
                    { conversation_id: chat, user_id: user },
                    { muted: !own.muted },
                  ),
                own.muted ? 'Conversation unmuted.' : 'Conversation muted.',
              )
            }
          >
            {own.muted ? 'Unmute' : 'Mute'}
          </Button>
        )
      }
    >
      <div className="chat-meta">
        {peer && <Person id={peer.user_id} />}
        <span>
          {typing ? 'Typing…' : online ? online + ' active here' : 'Conversation history'}
        </span>
      </div>
      <QueryState {...messages} />
      <Feedback {...end} notice={end.notice || completion} />
      <Feedback {...action} />
      {messages.data.length >= 100 && !limit && (
        <Button onClick={() => setLimit(true)}>Load older messages</Button>
      )}
      <div className="message-history" aria-label="Message history">
        {history
          .slice()
          .reverse()
          .map((m) => (
            <article
              key={m.id}
              className={'message ' + (m.author_id === user ? 'own-message' : '')}
            >
              <div className="message-meta">
                <strong>{m.author_id === user ? 'You' : <Person id={m.author_id} />}</strong>
                <time dateTime={m.created_at}>
                  {dateLabel(m.created_at, { hour: 'numeric', minute: '2-digit' })}
                </time>
              </div>
              {m.reply_to && (
                <div className="reply-quote">
                  {history.find((r) => r.id === m.reply_to)?.body.slice(0, 100) ||
                    'Previous message'}
                </div>
              )}
              <RichText text={m.body} />
              {files.data
                .filter((f) => f.message_id === m.id)
                .map((f) => (
                  <Attachment key={f.id} bucket="study-attachments" path={f.path} label={f.label} />
                ))}
              <div className="message-actions">
                <button className="subtle" onClick={() => setReply(m)}>
                  Reply
                </button>
                {m.author_id !== user && <Report kind="message" item={m.id!} />}
              </div>
            </article>
          ))}
        {!messages.loading && !messages.data.length && (
          <Empty
            icon={MessageCircle}
            title="Start with the topic"
            detail="Ask what your partner wants to cover or share your first worked example."
          />
        )}
      </div>
      {reply && (
        <div className="inline-note">
          Replying to {reply.body.slice(0, 70)}{' '}
          <Button onClick={() => setReply(null)}>Clear reply</Button>
        </div>
      )}
      <Form
        className="composer"
        onSubmit={(d) =>
          action.run(async () => {
            const content = field(d, 'message'),
              file = fileFrom(d, 'file');
            if (!content && !file) throw new Error('Write a message or attach a file.');
            const path = file
              ? await db.upload('study-attachments', chat + '/' + user, file)
              : null;
            try {
              await db.rpc('send_message', {
                chat,
                content: content || 'Shared an attachment',
                reply: reply?.id ?? null,
                file_path: path,
                file_label: file?.name ?? null,
              });
            } catch (e) {
              if (path)
                try {
                  await db.discard('study-attachments', path);
                } catch (cleanup) {
                  console.warn(cleanup);
                }
              throw e;
            }
            setReply(null);
          })
        }
      >
        <label className="field">
          <span>Message</span>
          <textarea
            name="message"
            maxLength={4000}
            rows={2}
            placeholder="Write a message… $equations$ and fenced code work here."
            onChange={write}
          />
        </label>
        <div className="button-row">
          <label className="field file-field">
            <span>
              <Paperclip size={15} /> Attachment
            </span>
            <input type="file" name="file" accept={attachmentAccept} />
          </label>
          <Button type="submit" className="primary" disabled={action.busy}>
            <Send size={16} /> Send message
          </Button>
        </div>
      </Form>
      {session && !session.completed_at && (
        <div className="button-row">
          <Button
            disabled={end.busy}
            onClick={() =>
              void end.run(async () => {
                const done = await db.rpc<boolean>('complete_session', { session: session.id });
                setCompletion(
                  done
                    ? 'Session completed.'
                    : 'Your completion is recorded. Your partner must confirm too.',
                );
              })
            }
          >
            Confirm session completion
          </Button>
        </div>
      )}
      {session?.completed_at && (
        <p className="inline-note">
          <Check size={16} /> Study session complete
        </p>
      )}
      {entitlement && !entitlement.used_at && <Review session={session!.id!} />}
      {entitlement?.used_at && <p className="muted">Your anonymous feedback was submitted.</p>}
      {peer && (
        <Disclosure label="Conversation safety">
          <p className="muted">Blocking stops direct contact. You can unblock from Privacy.</p>
          <Button
            onClick={() =>
              void end.run(
                () => db.insert('blocked_users', { owner_id: user, blocked_id: peer.user_id }),
                'Student blocked.',
              )
            }
            disabled={end.busy}
          >
            <UserRoundMinus size={16} /> Block student
          </Button>
          <Report kind="user" item={peer.user_id} />
        </Disclosure>
      )}
      {demo && (
        <p className="fine-print">
          Use the demo student selector to reply or confirm as the other student.
        </p>
      )}
    </Section>
  );
}
function Review({ session }: { session: string }) {
  const { db } = useWorkspace();
  const action = useAction();
  const fields = [
    'Clarity of explanation',
    'Subject understanding',
    'Communication',
    'Patience',
    'Helpfulness',
    'Reliability',
    'Respectfulness',
    'Overall experience',
  ];
  return (
    <Disclosure label="Leave anonymous feedback">
      <p className="muted">
        Your ratings contribute to a private aggregate after three different reviewers. Written
        feedback is kept private.
      </p>
      <Form
        onSubmit={(d) =>
          action.run(
            () =>
              db.rpc('submit_review', {
                session,
                ratings: fields.map((_, i) => Number(field(d, 'rating' + i))),
                recognition: optional(d, 'badge'),
                note: optional(d, 'note'),
              }),
            'Anonymous feedback submitted.',
          )
        }
      >
        <div className="form-grid">
          {fields.map((f, i) => (
            <Select
              key={f}
              label={f}
              name={'rating' + i}
              options={['1', '2', '3', '4', '5']}
              defaultValue="5"
            />
          ))}
        </div>
        <Select
          label="Recognition"
          name="badge"
          placeholder="No badge"
          options={[
            'Great explainer',
            'Patient mentor',
            'Very helpful',
            'Reliable study partner',
            'Good communicator',
            'Friendly and respectful',
            'Concept clarity',
          ]}
        />
        <Area label="Optional private feedback" name="note" maxLength={600} />
        <Button className="primary" type="submit" disabled={action.busy}>
          Submit anonymous feedback
        </Button>
        <Feedback {...action} />
      </Form>
    </Disclosure>
  );
}
function Partnerships() {
  const { db } = useWorkspace();
  const requests = useRows('accountability_partnerships', { order: 'updated_at', desc: true });
  const action = useAction();
  return (
    <Section
      title="Accountability partners"
      action={<ButtonLink to="/connect?intent=Accountability">Find a partner</ButtonLink>}
    >
      <QueryState {...requests} />
      <Feedback {...action} />
      {!requests.loading && !requests.data.length && (
        <Empty
          icon={CalendarClock}
          title="Make time to check in"
          detail="Use the Accountability intent when finding a partner. An accepted request starts a private partnership."
        />
      )}
      {requests.data.map((p) => (
        <Disclosure key={p.id} label={p.goal || 'Shared study goal · ' + p.status}>
          <Form
            reset={false}
            onSubmit={(d) =>
              action.run(
                () =>
                  db.rpc('update_partnership', {
                    partnership: p.id,
                    new_goal: optional(d, 'goal'),
                    new_check_in: field(d, 'checkin')
                      ? new Date(field(d, 'checkin')).toISOString()
                      : null,
                    new_status: field(d, 'status'),
                  }),
                'Partnership updated.',
              )
            }
          >
            <Field label="Shared goal" name="goal" defaultValue={p.goal || ''} maxLength={500} />
            <Field
              label="Next check-in"
              name="checkin"
              type="datetime-local"
              defaultValue={
                p.check_in
                  ? new Date(
                      Date.parse(p.check_in) - new Date(p.check_in).getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ''
              }
            />
            <Select
              label="Status"
              name="status"
              options={['active', 'paused', 'ended']}
              defaultValue={p.status}
            />
            <div className="button-row">
              <Button
                className="primary"
                type="submit"
                disabled={action.busy || p.status === 'ended'}
              >
                Save partnership
              </Button>
              <ButtonLink to={'/connect?tab=Messages&chat=' + p.session_id}>
                Open shared chat
              </ButtonLink>
            </div>
          </Form>
        </Disclosure>
      ))}
    </Section>
  );
}
