import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  CircleHelp,
  Lock,
  MessageCircle,
  Plus,
  ThumbsUp,
  UsersRound,
} from 'lucide-react';
import {
  Area,
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

const tabs = ['Explore', 'Questions', 'Groups'];
export default function Communities() {
  const [p] = useSearchParams();
  const tab = p.get('tab') || 'Explore',
    community = p.get('community'),
    question = p.get('question'),
    group = p.get('group');
  return (
    <>
      <PageTitle
        title="Communities"
        detail="Find your subject circles, share a question and learn from other students."
      />
      <Tabs labels={tabs} />
      {tab === 'Questions' ? (
        <Questions key={p.get('q') || ''} query={p.get('q') || ''} question={question} />
      ) : tab === 'Groups' ? (
        <Groups group={group} />
      ) : (
        <Explore community={community} />
      )}
    </>
  );
}
function Explore({ community }: { community: string | null }) {
  const { user } = useWorkspace();
  const all = useRows('communities', { order: 'name' });
  const mine = useRows('community_members', { where: { user_id: user } });
  const [filter, setFilter] = useState('All communities'),
    [search, setSearch] = useState('');
  if (community) {
    const item = all.data.find((c) => c.id === community);
    return item ? (
      <Community community={item} joined={mine.data.some((m) => m.community_id === item.id)} />
    ) : (
      <>
        <QueryState {...all} />
        {!all.loading && <Empty title="Community unavailable" />}
      </>
    );
  }
  const matches = all.data.filter(
    (c) =>
      (filter === 'All communities' ||
        (filter === 'Joined'
          ? mine.data.some((r) => r.community_id === c.id)
          : c.category === filter)) &&
      (c.name + ' ' + c.description).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="filter-strip">
        <Field
          label="Search communities"
          placeholder="Search by name or topic…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          label="Category"
          options={['All communities', 'Joined', 'Subject', 'University', 'Local', 'Exam']}
          value={filter}
          onChange={setFilter}
        />
      </div>
      <QueryState {...all} />
      <div className="card-grid">
        {matches.map((c) => (
          <article className="panel community-card" key={c.id}>
            <div className="card-top">
              <SubjectIcon subject={c.subject_id || c.id} size={22} />
              <span className="chip">
                {mine.data.some((m) => m.community_id === c.id) ? 'Joined' : c.category}
              </span>
            </div>
            <h3>{c.name}</h3>
            <p>{c.description}</p>
            <Link className="text-link" to={'/communities?community=' + c.id}>
              Open community <ArrowRight size={15} />
            </Link>
          </article>
        ))}
      </div>
      {!all.loading && !matches.length && (
        <Empty title="No communities found" detail="Try another category or search term." />
      )}
    </>
  );
}
function Community({ community, joined }: { community: Row; joined: boolean }) {
  const { db, user, role } = useWorkspace();
  const action = useAction();
  const channels = useRows('community_channels', {
    where: { community_id: community.id! },
    order: 'name',
  });
  const posts = useRows('community_posts', {
    where: { community_id: community.id! },
    order: 'created_at',
    desc: true,
    limit: 100,
  });
  const [channel, setChannel] = useState(''),
    [q, setQ] = useState('');
  return (
    <>
      <Link className="text-link back-link" to="/communities">
        <ArrowLeft size={16} /> All communities
      </Link>
      <Section
        title={community.name}
        action={
          <Button
            className={joined ? '' : 'primary'}
            disabled={action.busy}
            onClick={() =>
              void action.run(
                () =>
                  joined
                    ? db.remove('community_members', { user_id: user, community_id: community.id! })
                    : db.insert('community_members', { user_id: user, community_id: community.id }),
                joined ? 'Left the community.' : 'Joined the community.',
              )
            }
          >
            {joined ? 'Leave community' : 'Join community'}
          </Button>
        }
      >
        <p className="muted">{community.description}</p>
        <Feedback {...action} />
        <div className="filter-strip">
          <Select
            label="Channel"
            options={optionsFrom(channels.data)}
            placeholder="All channels"
            value={channel}
            onChange={setChannel}
          />
          <Field label="Search discussions" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {joined && (
          <Disclosure label="Start a discussion">
            <Form
              onSubmit={(d) =>
                action.run(
                  () =>
                    db.rpc('publish_post', {
                      community: community.id,
                      title_text: field(d, 'title'),
                      body_text: field(d, 'body'),
                      channel: optional(d, 'channel'),
                      options: field(d, 'poll')
                        ? field(d, 'poll')
                            .split('|')
                            .map((s) => s.trim())
                        : null,
                    }),
                  'Discussion posted.',
                )
              }
            >
              <Field label="Title" name="title" required maxLength={160} />
              <Area label="Discussion" name="body" required maxLength={5000} />
              <Select
                label="Topic channel"
                name="channel"
                options={optionsFrom(channels.data)}
                defaultValue={channel}
                placeholder="General discussion"
              />
              <Field label="Optional poll choices (separate with |)" name="poll" maxLength={420} />
              <Button type="submit" className="primary" disabled={action.busy}>
                Publish discussion
              </Button>
            </Form>
          </Disclosure>
        )}
        <QueryState {...posts} />
        {posts.data
          .filter(
            (r) =>
              (!channel || r.channel_id === channel) &&
              (r.title + ' ' + r.body).toLowerCase().includes(q.toLowerCase()),
          )
          .sort((a, b) => Number(b.pinned) - Number(a.pinned))
          .map((post) => (
            <Post key={post.id} post={post} joined={joined} canPin={role !== 'student'} />
          ))}
        {!posts.loading && !posts.data.length && (
          <Empty
            title="Start the first discussion"
            detail="Share a useful explanation or ask what other students are working on."
          />
        )}
      </Section>
    </>
  );
}
function Post({ post, joined, canPin }: { post: Row; joined: boolean; canPin: boolean }) {
  const { db, user } = useWorkspace();
  const action = useAction();
  const comments = useRows('community_comments', {
    where: { post_id: post.id! },
    order: 'created_at',
  });
  const saved = useRows('post_bookmarks', { where: { post_id: post.id!, user_id: user } });
  const polls = useRPC<Row[]>('poll_results', { post: post.id }, []);
  const [reply, setReply] = useState<string | null>(null);
  return (
    <article className="discussion">
      <div className="discussion-header">
        <h3>{post.title}</h3>
        {post.pinned && <span className="chip">Pinned</span>}
      </div>
      <p className="fine-print">
        <Person id={post.author_id} /> · {dateLabel(post.created_at)}
      </p>
      <RichText text={post.body} />
      {post.poll_options && (
        <div className="poll">
          {post.poll_options.map((option: string, i: number) => (
            <Button
              key={i}
              disabled={!joined || action.busy}
              onClick={() =>
                void action.run(
                  () => db.rpc('vote_poll', { post: post.id, option_number: i + 1 }),
                  'Vote recorded.',
                )
              }
            >
              {option}
              <span className="chip">
                {polls.data.find((r) => r.choice === i + 1)?.votes ?? 0} votes
              </span>
            </Button>
          ))}
        </div>
      )}
      <div className="button-row">
        <Button
          onClick={() =>
            void action.run(
              () =>
                saved.data.length
                  ? db.remove('post_bookmarks', { post_id: post.id!, user_id: user })
                  : db.insert('post_bookmarks', { post_id: post.id, user_id: user }),
              saved.data.length ? 'Removed bookmark.' : 'Discussion saved.',
            )
          }
        >
          <Bookmark size={15} />
          {saved.data.length ? 'Saved' : 'Save post'}
        </Button>
        {canPin && (
          <Button
            onClick={() =>
              void action.run(() =>
                db.rpc('admin_action', {
                  kind: 'post',
                  item: post.id,
                  action: post.pinned ? 'unpin' : 'pin',
                }),
              )
            }
          >
            {post.pinned ? 'Unpin' : 'Pin'}
          </Button>
        )}
        <Report kind="post" item={post.id!} />
      </div>
      <Disclosure label={'Replies (' + comments.data.length + ')'}>
        {comments.data.map((c) => (
          <div className="comment" key={c.id}>
            <p className="fine-print">
              <Person id={c.author_id} />
              {c.reply_to ? ' · Reply' : ''}
            </p>
            <RichText text={c.body} />
            {joined && (
              <button className="subtle" onClick={() => setReply(c.id!)}>
                Reply
              </button>
            )}
          </div>
        ))}
        {joined && (
          <Form
            onSubmit={(d) =>
              action.run(async () => {
                await db.rpc('add_comment', {
                  kind: 'post',
                  target: post.id,
                  content: field(d, 'comment'),
                  parent: reply,
                });
                setReply(null);
              }, 'Reply published.')
            }
          >
            <Area
              label={reply ? 'Reply to comment' : 'Add a reply'}
              name="comment"
              required
              maxLength={2000}
            />
            {reply && <Button onClick={() => setReply(null)}>Clear reply</Button>}
            <Button type="submit" disabled={action.busy}>
              Publish reply
            </Button>
          </Form>
        )}
      </Disclosure>
      <Feedback {...action} />
    </article>
  );
}
function Questions({ query, question }: { query: string; question: string | null }) {
  const data = useRows('questions', { order: 'created_at', desc: true, limit: 200 });
  const [search, setSearch] = useState(query),
    [subject, setSubject] = useState(''),
    [sort, setSort] = useState('All questions'),
    [compose, setCompose] = useState(false);
  const { user } = useWorkspace();
  const saved = useRows('question_bookmarks', { where: { user_id: user } });
  const [, setParams] = useSearchParams();
  if (question) {
    const q = data.data.find((r) => r.id === question);
    return q ? (
      <Question
        question={q}
        similar={data.data
          .filter((x) => x.id !== q.id && x.subject_id === q.subject_id)
          .slice(0, 3)}
      />
    ) : (
      <>
        <QueryState {...data} />
        {!data.loading && <Empty title="Question unavailable" />}
      </>
    );
  }
  const rows = data.data.filter(
    (q) =>
      (!subject || q.subject_id === subject) &&
      [q.title, q.topic, q.body].join(' ').toLowerCase().includes(search.toLowerCase()) &&
      (sort === 'Unanswered'
        ? q.answer_count === 0
        : sort === 'Recently answered'
          ? q.answer_count > 0
          : sort === 'Saved questions'
            ? saved.data.some((s) => s.question_id === q.id)
            : true),
  );
  if (sort === 'Most discussed') rows.sort((a, b) => b.answer_count - a.answer_count);
  return (
    <Section
      title="Academic Q&A"
      action={
        <Button className="primary" onClick={() => setCompose(!compose)}>
          <Plus size={17} />
          {compose ? 'Close form' : 'Ask a question'}
        </Button>
      }
    >
      {compose && (
        <QuestionForm
          questions={data.data}
          onPost={(id) => {
            setCompose(false);
            setParams({ tab: 'Questions', question: id });
          }}
        />
      )}
      <div className="filter-strip">
        <Field
          label="Search questions"
          placeholder="Title, topic or keyword"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SubjectSelect required={false} value={subject} onChange={setSubject} />
        <Select
          label="View"
          options={[
            'All questions',
            'Unanswered',
            'Recently answered',
            'Most discussed',
            'Saved questions',
          ]}
          value={sort}
          onChange={setSort}
        />
      </div>
      <QueryState {...data} />
      {rows.map((q) => (
        <Link className="list-row" key={q.id} to={'/communities?tab=Questions&question=' + q.id}>
          <SubjectIcon subject={q.subject_id} />
          <span>
            <strong>{q.title}</strong>
            <small>
              {q.topic || 'Academic question'} · <Person id={q.author_id} />
            </small>
          </span>
          {q.accepted_answer_id && <span className="chip success-chip">Accepted answer</span>}
          <span className="reply-count">
            <MessageCircle size={15} />
            {q.answer_count}
          </span>
        </Link>
      ))}
      {!data.loading && !rows.length && (
        <Empty
          icon={CircleHelp}
          title="No matching questions"
          detail="Change your filters or ask your own question."
        />
      )}
    </Section>
  );
}
function QuestionForm({ onPost, questions }: { onPost: (id: string) => void; questions: Row[] }) {
  const { db, user } = useWorkspace();
  const action = useAction();
  const levels = useRows('education_levels', { order: 'name' });
  const membership = useRows('community_members', { where: { user_id: user } });
  const communities = useRows('communities');
  const [title, setTitle] = useState('');
  const related =
    title.trim().length > 7
      ? questions
          .filter((q) => q.title.toLowerCase().includes(title.trim().toLowerCase()))
          .slice(0, 3)
      : [];
  return (
    <Form
      className="inset-form"
      onSubmit={(d) =>
        action.run(async () => {
          const file = fileFrom(d, 'attachment');
          const path = file ? await db.upload('study-question-files', 'questions', file) : null;
          try {
            const id = await db.rpc<string>('post_question', {
              title_text: field(d, 'title'),
              body_text: field(d, 'body'),
              subject: field(d, 'subject'),
              topic_text: optional(d, 'topic'),
              level: optional(d, 'level'),
              anonymous: d.has('anonymous'),
              community: optional(d, 'community'),
              file_path: path,
              file_label: file?.name ?? null,
            });
            onPost(id);
          } catch (e) {
            if (path)
              try {
                await db.discard('study-question-files', path);
              } catch (cleanup) {
                console.warn(cleanup);
              }
            throw e;
          }
        }, 'Question published.')
      }
    >
      <Field
        label="Question title"
        name="title"
        required
        maxLength={160}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      {related.map((q) => (
        <Link key={q.id} className="text-link" to={'/communities?tab=Questions&question=' + q.id}>
          Similar question · {q.title}
        </Link>
      ))}
      <div className="form-grid">
        <SubjectSelect />
        <Field label="Topic" name="topic" maxLength={100} />
        <Select
          label="Education level"
          name="level"
          options={optionsFrom(levels.data)}
          placeholder="Optional"
        />
        <Select
          label="Community"
          name="community"
          placeholder="General Q&A"
          options={optionsFrom(
            communities.data.filter((c) => membership.data.some((m) => m.community_id === c.id)),
          )}
        />
      </div>
      <Area
        label="What have you tried so far?"
        name="body"
        required
        placeholder="Describe the concept you’re working through. Use $...$ for math or fenced code."
      />
      <Field type="file" label="Optional attachment" name="attachment" accept={attachmentAccept} />
      <Check name="anonymous" defaultChecked>
        Post anonymously
      </Check>
      <p className="muted">
        Remove names and identifying details from text and files. Ask for explanations and avoid
        sharing graded assessments, leaked papers or copyrighted material.
      </p>
      <Button className="primary" type="submit" disabled={action.busy}>
        Publish question
      </Button>
      <Feedback {...action} />
    </Form>
  );
}
function Question({ question, similar }: { question: Row; similar: Row[] }) {
  const { db, user } = useWorkspace();
  const action = useAction();
  const answers = useRows('answers', { where: { question_id: question.id! }, order: 'created_at' });
  const owners = useRPC<string[]>('my_questions', undefined, []);
  const saved = useRows('question_bookmarks', {
    where: { question_id: question.id!, user_id: user },
  });
  return (
    <>
      <Link className="text-link back-link" to="/communities?tab=Questions">
        <ArrowLeft size={16} /> Academic Q&A
      </Link>
      <Section
        title={question.title}
        action={
          <Button
            onClick={() =>
              void action.run(() =>
                saved.data.length
                  ? db.remove('question_bookmarks', { question_id: question.id!, user_id: user })
                  : db.insert('question_bookmarks', { question_id: question.id, user_id: user }),
              )
            }
          >
            <Bookmark size={16} />
            {saved.data.length ? 'Saved' : 'Save question'}
          </Button>
        }
      >
        <p className="fine-print">
          <Person id={question.author_id} /> · {dateLabel(question.created_at)}{' '}
          {question.topic && '· ' + question.topic}
        </p>
        <RichText text={question.body} />
        {question.attachment_path && (
          <Attachment
            bucket="study-question-files"
            path={question.attachment_path}
            label={question.attachment_label || 'question attachment'}
          />
        )}
        <Report kind="question" item={question.id!} />
        <Feedback {...action} />
      </Section>
      <Section title="Explanations">
        <QueryState {...answers} />
        {answers.data
          .slice()
          .sort(
            (a, b) =>
              Number(b.id === question.accepted_answer_id) -
                Number(a.id === question.accepted_answer_id) || b.helpful_count - a.helpful_count,
          )
          .map((a) => (
            <Answer
              key={a.id}
              answer={a}
              question={question}
              myQuestion={owners.data.includes(question.id!)}
            />
          ))}
        {!answers.loading && !answers.data.length && (
          <Empty
            title="No explanations yet"
            detail="Share a step-by-step explanation to get the discussion started."
          />
        )}
        <Form
          onSubmit={(d) =>
            action.run(async () => {
              const file = fileFrom(d, 'attachment');
              const path = file ? await db.upload('study-question-files', 'questions', file) : null;
              try {
                await db.rpc('add_answer', {
                  question: question.id,
                  content: field(d, 'answer'),
                  file_path: path,
                  file_label: file?.name ?? null,
                });
              } catch (e) {
                if (path)
                  try {
                    await db.discard('study-question-files', path);
                  } catch (cleanup) {
                    console.warn(cleanup);
                  }
                throw e;
              }
            }, 'Explanation posted.')
          }
        >
          <Area
            label="Your explanation"
            name="answer"
            required
            placeholder="Walk through the reasoning, with a small example if possible."
          />
          <Field
            label="Optional diagram or attachment"
            name="attachment"
            type="file"
            accept={attachmentAccept}
          />
          <Button className="primary" type="submit" disabled={action.busy}>
            Post explanation
          </Button>
          <Feedback {...action} />
        </Form>
      </Section>
      {similar.length > 0 && (
        <Section title="Similar questions">
          {similar.map((q) => (
            <Link
              key={q.id}
              className="list-row"
              to={'/communities?tab=Questions&question=' + q.id}
            >
              <SubjectIcon subject={q.subject_id} />
              {q.title}
            </Link>
          ))}
        </Section>
      )}
    </>
  );
}
function Answer({
  answer,
  question,
  myQuestion,
}: {
  answer: Row;
  question: Row;
  myQuestion: boolean;
}) {
  const { user, db } = useWorkspace();
  const action = useAction();
  const voted = useRows('answer_reactions', { where: { answer_id: answer.id!, user_id: user } });
  const comments = useRows('answer_comments', { where: { answer_id: answer.id! } });
  const accepted = question.accepted_answer_id === answer.id;
  return (
    <article className="discussion answer">
      <div className="discussion-header">
        <strong>
          <Person id={answer.author_id} />
        </strong>
        {accepted && (
          <span className="chip success-chip">
            <CheckCircle2 size={14} /> Accepted by question author
          </span>
        )}
      </div>
      <RichText text={answer.body} />
      {answer.attachment_path && (
        <Attachment
          bucket="study-question-files"
          path={answer.attachment_path}
          label={answer.attachment_label || 'answer attachment'}
        />
      )}
      <div className="button-row">
        <Button
          onClick={() => void action.run(() => db.rpc('toggle_helpful', { answer: answer.id }))}
          aria-pressed={!!voted.data.length}
          disabled={answer.author_id === user || action.busy}
        >
          <ThumbsUp size={15} /> Helpful · {answer.helpful_count}
        </Button>
        {myQuestion && !accepted && (
          <Button
            onClick={() =>
              void action.run(
                () => db.rpc('accept_answer', { question: question.id, answer: answer.id }),
                'Answer accepted.',
              )
            }
            disabled={action.busy}
          >
            Accept answer
          </Button>
        )}
        <Report kind="answer" item={answer.id!} />
      </div>
      {accepted && (
        <p className="fine-print">
          Acceptance reflects the question author’s choice. Professional verification is
          unavailable.
        </p>
      )}
      <Disclosure label={'Comments and corrections (' + comments.data.length + ')'}>
        {comments.data.map((c) => (
          <div key={c.id} className="comment">
            <strong>
              <Person id={c.author_id} />
            </strong>
            <RichText text={c.body} />
          </div>
        ))}
        <Form
          onSubmit={(d) =>
            action.run(
              () =>
                db.rpc('add_comment', {
                  kind: 'answer',
                  target: answer.id,
                  content: field(d, 'comment'),
                }),
              'Comment added.',
            )
          }
        >
          <Area label="Comment or suggested correction" name="comment" required maxLength={2000} />
          <Button type="submit" disabled={action.busy}>
            Post comment
          </Button>
        </Form>
      </Disclosure>
      <Feedback {...action} />
    </article>
  );
}

const categories = [
  'Subject revision',
  'Exam preparation',
  'Assignment discussion',
  'Project collaboration',
  'Daily study',
  'Weekly revision',
  'Programming practice',
  'Accountability',
];
function Groups({ group }: { group: string | null }) {
  const { db, user } = useWorkspace();
  const action = useAction();
  const groups = useRows('study_groups', { order: 'created_at', desc: true });
  const mine = useRows('study_group_members', { where: { user_id: user } });
  const [, setParams] = useSearchParams();
  const [create, setCreate] = useState(false);
  if (group) {
    const g = groups.data.find((r) => r.id === group);
    return g ? (
      <Group group={g} membership={mine.data.find((m) => m.group_id === g.id)} />
    ) : (
      <>
        <QueryState {...groups} />
        {!groups.loading && <Empty title="Study group unavailable" />}
      </>
    );
  }
  return (
    <Section
      title="Study groups"
      action={
        <Button className="primary" onClick={() => setCreate(!create)}>
          <Plus size={16} />
          {create ? 'Close form' : 'Create group'}
        </Button>
      }
    >
      <QueryState {...groups} />
      {create && (
        <Form
          className="inset-form"
          onSubmit={(d) =>
            action.run(async () => {
              const id = await db.rpc<string>('create_group', {
                group_name: field(d, 'name'),
                details: field(d, 'details'),
                subject: field(d, 'subject'),
                topic_text: optional(d, 'topic'),
                kind: field(d, 'category'),
                max_members: Number(field(d, 'capacity')),
                access: field(d, 'privacy'),
                meeting_format: field(d, 'format'),
              });
              setCreate(false);
              setParams({ tab: 'Groups', group: id });
            }, 'Group created.')
          }
        >
          <Field label="Group name" name="name" required maxLength={100} />
          <Area label="What will the group study?" name="details" required maxLength={1500} />
          <div className="form-grid">
            <SubjectSelect />
            <Field label="Topic" name="topic" maxLength={100} />
            <Select label="Category" name="category" options={categories} />
            <Field
              label="Group size"
              type="number"
              name="capacity"
              defaultValue={8}
              min={2}
              max={30}
              required
            />
            <Select
              label="Membership"
              name="privacy"
              options={['Open', 'Approval', 'Invitation']}
            />
            <Select label="Study format" name="format" options={['Online', 'Local public space']} />
          </div>
          <Button className="primary" type="submit" disabled={action.busy}>
            Create study group
          </Button>
          <Feedback {...action} />
        </Form>
      )}
      {groups.data.map((g) => (
        <Link key={g.id} className="list-row" to={'/communities?tab=Groups&group=' + g.id}>
          <SubjectIcon subject={g.subject_id} />
          <span>
            <strong>{g.name}</strong>
            <small>
              {g.category} · {g.format}
            </small>
          </span>
          <span className="chip">
            {mine.data.find((m) => m.group_id === g.id)?.status || g.privacy}
          </span>
          <ChevronRightIcon />
        </Link>
      ))}
      {!groups.loading && !groups.data.length && (
        <Empty
          icon={UsersRound}
          title="No study groups yet"
          detail="Create a circle for your next revision session."
        />
      )}
    </Section>
  );
}
function ChevronRightIcon() {
  return <ArrowRight size={15} />;
}
function Group({ group, membership }: { group: Row; membership?: Row }) {
  const { db, user } = useWorkspace();
  const action = useAction();
  const team = group.id!,
    leader = group.owner_id === user,
    joined = membership?.status === 'active';
  const members = useRows('study_group_members', { where: { group_id: team } });
  const announcements = useRows('group_announcements', {
    where: { group_id: team },
    order: 'created_at',
    desc: true,
  });
  const groupResources = useRows('group_resources', { where: { group_id: team } });
  const resources = useRows('resources');
  const room = useRows('study_rooms', { where: { id: team } });
  const change = (decision: string, member?: string) =>
    action.run(
      () => db.rpc('group_membership', { team, decision, member: member ?? null }),
      'Membership updated.',
    );
  return (
    <>
      <Link className="text-link back-link" to="/communities?tab=Groups">
        <ArrowLeft size={16} /> Study groups
      </Link>
      <Section
        title={group.name}
        action={
          joined ? (
            <ButtonLink primary to={'/study?tab=Rooms&room=' + team}>
              Open study room
            </ButtonLink>
          ) : (
            <Button
              className="primary"
              disabled={
                action.busy ||
                membership?.status === 'pending' ||
                (group.privacy === 'Invitation' && !membership)
              }
              onClick={() => void change('join')}
            >
              {membership?.status === 'pending'
                ? 'Approval pending'
                : membership?.status === 'invited'
                  ? 'Accept invitation'
                  : group.privacy === 'Approval'
                    ? 'Request membership'
                    : 'Join group'}
            </Button>
          )
        }
      >
        <p>{group.description}</p>
        <p className="fine-print">
          <Lock size={15} />
          {group.privacy} · {group.capacity} seats · {group.format}
        </p>
        <p className="fine-print">
          Group leader · <Person id={group.owner_id} />
        </p>
        {group.format !== 'Online' && (
          <p className="inline-note">
            Arrange in-person sessions in a public campus or library study space. Keep meeting
            details within the group.
          </p>
        )}
        <Feedback {...action} />
        {joined && (
          <div className="button-row">
            <ButtonLink to={'/connect?tab=Messages&chat=' + team}>Group chat</ButtonLink>
            {!leader && (
              <Button onClick={() => void change('leave')} disabled={action.busy}>
                Leave group
              </Button>
            )}
          </div>
        )}
      </Section>
      {joined && (
        <div className="two-column">
          <Section title="Group members">
            {members.data.map((m) => (
              <div className="list-row" key={m.user_id}>
                <strong>
                  <Person id={m.user_id} />
                </strong>
                <span className="chip">{m.status}</span>
                {leader && m.user_id !== user && (
                  <div className="button-row">
                    {m.status === 'pending' && (
                      <Button
                        disabled={action.busy}
                        onClick={() => void change('approve', m.user_id)}
                      >
                        Approve
                      </Button>
                    )}
                    <Button disabled={action.busy} onClick={() => void change('leave', m.user_id)}>
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {leader && (
              <Disclosure label="Invite using a student’s profile ID">
                <Form onSubmit={(d) => change('invite', field(d, 'member'))}>
                  <Field label="Student profile ID" name="member" required maxLength={40} />
                  <Button type="submit" disabled={action.busy}>
                    Send invitation
                  </Button>
                </Form>
              </Disclosure>
            )}
          </Section>
          <Section title="Schedule and announcements">
            {room.data[0]?.scheduled_at && (
              <p>
                Next session ·{' '}
                {dateLabel(room.data[0].scheduled_at, { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            )}
            {announcements.data.map((a) => (
              <div className="comment" key={a.id}>
                <RichText text={a.body} />
              </div>
            ))}
            {leader && (
              <Disclosure label="Publish an announcement">
                <Form
                  onSubmit={(d) =>
                    action.run(
                      () => db.rpc('announce', { team, content: field(d, 'body') }),
                      'Announcement published.',
                    )
                  }
                >
                  <Area label="Announcement" name="body" required maxLength={1000} />
                  <Button type="submit" disabled={action.busy}>
                    Publish
                  </Button>
                </Form>
              </Disclosure>
            )}
          </Section>
          <Section title="Shared resources">
            {groupResources.data
              .map((r) => resources.data.find((x) => x.id === r.resource_id))
              .filter(Boolean)
              .map((r) => (
                <Link className="list-row" key={r!.id} to={'/resources?resource=' + r!.id}>
                  {r!.title}
                </Link>
              ))}
            {leader && (
              <Form
                onSubmit={(d) =>
                  action.run(
                    () =>
                      db.insert('group_resources', {
                        group_id: team,
                        resource_id: field(d, 'resource'),
                      }),
                    'Resource shared with group.',
                  )
                }
              >
                <Select
                  label="Library resource"
                  name="resource"
                  required
                  options={resources.data.map((r) => ({ value: r.id!, label: r.title }))}
                  placeholder="Choose a resource"
                />
                <Button type="submit" disabled={action.busy}>
                  Share in group
                </Button>
              </Form>
            )}
            {!groupResources.data.length && (
              <p className="muted">Shared group resources will appear here.</p>
            )}
          </Section>
        </div>
      )}
    </>
  );
}
