import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  Download,
  ExternalLink,
  LibraryBig,
  Plus,
  ThumbsUp,
} from 'lucide-react';
import {
  Area,
  Button,
  Check,
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
  field,
  fileFrom,
  optional,
  optionsFrom,
} from '../components/ui';
import { Attachment, Report } from '../components/Safety';
import { useAction, useRows, useRPC, useWorkspace } from '../hooks/workspace';
import { attachmentAccept } from '../services/live';
import type { Row } from '../types';
export const categories = [
  'Lecture notes',
  'Revision notes',
  'Formula sheet',
  'Practice questions',
  'Study guide',
  'Diagram',
  'Learning link',
  'Flashcards',
];
export default function Resources() {
  const [params] = useSearchParams();
  const id = params.get('resource');
  const { user, db } = useWorkspace();
  const action = useAction();
  const resources = useRows('resources', { order: 'created_at', desc: true, limit: 200 });
  const saved = useRows('resource_bookmarks', { where: { user_id: user } });
  const levels = useRows('education_levels', { order: 'name' });
  const courses = useRows('courses', { order: 'name' }),
    institutions = useRows('institutions', { order: 'name' });
  const [course, setCourse] = useState(''),
    [institution, setInstitution] = useState('');
  const [search, setSearch] = useState(''),
    [subject, setSubject] = useState(''),
    [category, setCategory] = useState(''),
    [level, setLevel] = useState(''),
    [only, setOnly] = useState(false),
    [upload, setUpload] = useState(false);
  const items = resources.data.filter(
    (r) =>
      (!subject || r.subject_id === subject) &&
      (!category || r.category === category) &&
      (!level || r.education_id === level) &&
      (!course || r.course_id === course) &&
      (!institution || r.institution_id === institution) &&
      (!only || saved.data.some((s) => s.resource_id === r.id)) &&
      [r.title, r.description, r.topic, r.exam]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const selected = resources.data.find((r) => r.id === id);
  return (
    <>
      <PageTitle
        title="Resources"
        detail="Find study materials shared by your peers and contribute something they can use."
        action={
          <Button className="primary" onClick={() => setUpload(!upload)}>
            <Plus size={17} />
            {upload ? 'Close upload' : 'Share a resource'}
          </Button>
        }
      />
      {upload && (
        <Section title="Share a learning resource">
          <Form
            onSubmit={(d) =>
              action.run(async () => {
                const file = fileFrom(d, 'file'),
                  url = optional(d, 'url');
                if (Boolean(file) === Boolean(url))
                  throw new Error('Choose a file or paste a link.');
                const path = file ? await db.upload('study-resources', user, file) : null;
                try {
                  await db.rpc('publish_resource', {
                    title_text: field(d, 'title'),
                    details: field(d, 'description'),
                    subject: field(d, 'subject'),
                    kind: field(d, 'category'),
                    permission: d.has('permission'),
                    object_path: path,
                    external_url: url,
                    topic_text: optional(d, 'topic'),
                    level: optional(d, 'level'),
                    course: optional(d, 'course'),
                    institution: optional(d, 'institution'),
                    exam_text: optional(d, 'exam'),
                  });
                } catch (e) {
                  if (path)
                    try {
                      await db.discard('study-resources', path);
                    } catch (cleanup) {
                      console.warn(cleanup);
                    }
                  throw e;
                }
              }, 'Resource published.')
            }
          >
            <Field label="Title" name="title" required maxLength={140} />
            <Area label="Description and preview" name="description" required maxLength={3000} />
            <div className="form-grid">
              <SubjectSelect />
              <Select label="Resource type" name="category" options={categories} />
              <Field label="Topic" name="topic" maxLength={100} />
              <Select
                label="Education level"
                name="level"
                options={optionsFrom(levels.data)}
                placeholder="Any level"
              />
              <Select
                label="Course"
                name="course"
                options={optionsFrom(courses.data)}
                placeholder="Optional"
              />
              <Select
                label="Institution"
                name="institution"
                options={optionsFrom(institutions.data)}
                placeholder="Optional"
              />
              <Field label="Examination" name="exam" maxLength={120} />
              <Field label="Upload a file" name="file" type="file" accept={attachmentAccept} />
              <Field
                label="Or paste an HTTPS learning link"
                name="url"
                type="url"
                maxLength={500}
              />
            </div>
            <Check name="permission" required>
              I have permission to share this material and it contains no confidential documents,
              copyrighted textbook copies or leaked exams.
            </Check>
            <Button className="primary" type="submit" disabled={action.busy}>
              Publish resource
            </Button>
            <Feedback {...action} />
          </Form>
        </Section>
      )}
      {id ? (
        <>
          <Link className="text-link back-link" to="/resources">
            <ArrowLeft size={16} /> Resource library
          </Link>
          {selected ? (
            <Section title={selected.title}>
              <Resource
                item={selected}
                saved={saved.data.some((s) => s.resource_id === selected.id)}
              />
            </Section>
          ) : (
            <>
              <QueryState {...resources} />
              {!resources.loading && <Empty title="Resource unavailable" />}
            </>
          )}
        </>
      ) : (
        <>
          <div className="filter-strip">
            <Field
              label="Search the library"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Title, topic or keyword"
            />
            <SubjectSelect required={false} value={subject} onChange={setSubject} />
            <Select
              label="Type"
              options={categories}
              placeholder="All formats"
              value={category}
              onChange={setCategory}
            />
            <Select
              label="Level"
              options={optionsFrom(levels.data)}
              placeholder="All levels"
              value={level}
              onChange={setLevel}
            />
            <Select
              label="Course"
              options={optionsFrom(courses.data)}
              placeholder="All courses"
              value={course}
              onChange={setCourse}
            />
            <Select
              label="Institution"
              options={optionsFrom(institutions.data)}
              placeholder="All institutions"
              value={institution}
              onChange={setInstitution}
            />
            <Button aria-pressed={only} onClick={() => setOnly(!only)}>
              <Bookmark size={16} /> Saved only
            </Button>
          </div>
          <QueryState {...resources} />
          <div className="card-grid">
            {items.map((r) => (
              <article className="panel community-card" key={r.id}>
                <div className="card-top">
                  <SubjectIcon subject={r.subject_id} />
                  <span className="chip">{r.category}</span>
                </div>
                <h3>{r.title}</h3>
                <p>{r.description}</p>
                <Link className="text-link" to={'/resources?resource=' + r.id}>
                  View resource <Download size={15} />
                </Link>
              </article>
            ))}
          </div>
          {!resources.loading && !items.length && (
            <Empty
              icon={LibraryBig}
              title="No resources match"
              detail="Clear your filters or share an original study resource."
            />
          )}
        </>
      )}
    </>
  );
}
function Resource({ item, saved }: { item: Row; saved: boolean }) {
  const { db, user } = useWorkspace();
  const action = useAction();
  const votes = useRows('resource_reactions', { where: { resource_id: item.id!, user_id: user } });
  const helpful = useRPC<number>('resource_helpful', { resource: item.id }, 0);
  const key = { resource_id: item.id!, user_id: user };
  return (
    <div className="resource-detail">
      <span className="chip">{item.category}</span>
      <p className="fine-print">
        Contributed by <Person id={item.author_id} />
        {item.topic && ' · ' + item.topic}
        {item.exam && ' · ' + item.exam}
      </p>
      <RichText text={item.description} />
      <div className="button-row">
        {item.path && (
          <Attachment bucket="study-resources" path={item.path} label="resource file" />
        )}
        {item.url && (
          <a className="button primary" href={item.url} target="_blank" rel="noreferrer noopener">
            Open learning link <ExternalLink size={15} />
          </a>
        )}
        <Button
          aria-pressed={saved}
          onClick={() =>
            void action.run(
              () =>
                saved ? db.remove('resource_bookmarks', key) : db.insert('resource_bookmarks', key),
              saved ? 'Bookmark removed.' : 'Resource bookmarked.',
            )
          }
        >
          <Bookmark size={15} />
          {saved ? 'Saved' : 'Save resource'}
        </Button>
        <Button
          aria-pressed={!!votes.data.length}
          onClick={() =>
            void action.run(() =>
              votes.data.length
                ? db.remove('resource_reactions', key)
                : db.insert('resource_reactions', key),
            )
          }
        >
          <ThumbsUp size={15} /> Helpful · {helpful.data}
        </Button>
      </div>
      <Report kind="resource" item={item.id!} />
      <Feedback {...action} />
    </div>
  );
}
