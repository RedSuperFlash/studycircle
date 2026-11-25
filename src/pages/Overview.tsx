import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Database,
  LayoutGrid,
  Lock,
  Network,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { Button, ButtonLink, PageTitle, Section } from '../components/ui';
const architecture = [
  {
    name: 'Student browser',
    icon: LayoutGrid,
    detail:
      'React, TypeScript and Vite deliver the six workspaces. GitHub Pages serves the files and hash routing handles navigation.',
  },
  {
    name: 'Supabase services',
    icon: Network,
    detail:
      'Supabase Auth manages verified sessions. Realtime sends authorized changes for messages, requests and room timers. Private Storage holds educational files.',
  },
  {
    name: 'PostgreSQL',
    icon: Database,
    detail:
      'SQL functions manage state changes and validation. Row-level security limits access to records by membership, ownership and role.',
  },
];
const relations = [
  ['Profile', 'Study request', 'Conversation', 'Message'],
  ['Profile', 'Community membership', 'Community', 'Discussion'],
  ['Profile', 'Question', 'Answer', 'Helpful reaction'],
  ['Study session', 'Participant', 'Review eligibility', 'Anonymous review'],
  ['Study group', 'Study room', 'Shared timer', 'Attendance'],
];
export default function Overview() {
  const [selected, setSelected] = useState(0),
    [relation, setRelation] = useState(0);
  return (
    <>
      <PageTitle
        title="Project overview"
        detail="StudyCircle · Learn together. Grow together."
        action={
          <ButtonLink to="/" primary>
            Open workspace <ArrowRight size={17} />
          </ButtonLink>
        }
      />
      <div className="two-column">
        <Section title="Why StudyCircle exists">
          <p>
            Students who study alone can struggle to get unstuck, find affordable support or build a
            steady routine. Some hesitate to ask basic questions in front of a class.
          </p>
          <p>
            StudyCircle gives college students aged 18 and over a place to ask questions, share
            explanations and work with peers who complement their strengths.
          </p>
        </Section>
        <Section title="What students can do">
          <ul className="overview-list">
            <li>Find a partner by subject, topic, language and availability.</li>
            <li>Ask a question under an alias or anonymously.</li>
            <li>
              Practice with flashcards and quizzes, track study goals and join shared focus rooms.
            </li>
            <li>Control location sharing, block unwanted contact and report content.</li>
          </ul>
        </Section>
      </div>
      <Section title="System architecture">
        <div className="diagram">
          {architecture.map((node, i) => (
            <Button key={node.name} aria-pressed={selected === i} onClick={() => setSelected(i)}>
              <node.icon size={19} />
              {node.name}
              {i < architecture.length - 1 && <ArrowRight size={16} />}
            </Button>
          ))}
        </div>
        <p>{architecture[selected].detail}</p>
      </Section>
      <Section title="Database relationships">
        <div className="button-row">
          {['Peer chat', 'Communities', 'Q&A', 'Feedback', 'Study rooms'].map((label, i) => (
            <Button key={label} aria-pressed={relation === i} onClick={() => setRelation(i)}>
              {label}
            </Button>
          ))}
        </div>
        <div className="diagram er-flow">
          {relations[relation].map((name, i) => (
            <div key={name}>
              <strong>{name}</strong>
              {i < 3 && <ArrowRight size={16} />}
            </div>
          ))}
        </div>
      </Section>
      <div className="two-column">
        <Section title="How matching works">
          <ul className="overview-list">
            <li>45 points for a complementary subject preference</li>
            <li>20 for a matching topic</li>
            <li>10 each for education level, language and availability</li>
            <li>5 for an eligible local cohort</li>
          </ul>
          <p>
            Each result explains its score. The live search breaks ties using compatible session
            preferences and positive feedback from multiple eligible reviews. The classroom tour
            uses a fictional cohort for the location walk-through.
          </p>
        </Section>
        <Section title="Location privacy">
          <p className="icon-copy">
            <Lock size={21} /> Students opt in to a coarse region. The radius preference maps to a
            region and the directory withholds local matches below a minimum cohort of five eligible
            peers. A student can use one local area per day.
          </p>
          <p>Worldwide study is available without location permission.</p>
        </Section>
        <Section title="Anonymous feedback">
          <p className="icon-copy">
            <UsersRound size={21} /> Both students confirm a session. Each receives one feedback
            entitlement. The recipient sees a private aggregate after three distinct reviewers.
          </p>
        </Section>
        <Section title="Moderation workflow">
          <p className="icon-copy">
            <ShieldCheck size={21} /> A submitted report creates a case. Staff open the reported
            item through an audited operation and can dismiss, hide or take an account action.
            Students can appeal eligible actions.
          </p>
        </Section>
        <Section title="Community guidelines" className="guidelines">
          <a id="guidelines" />
          <p className="icon-copy">
            <BookOpen size={21} /> Explain concepts respectfully. Ask for help without sharing
            private personal information. Use original or permitted study materials. Avoid
            impersonation, harassment, leaked papers and dishonest completion of graded assessments.
          </p>
          <p>If meeting a peer in person, choose a public library or campus study space.</p>
        </Section>
        <Section title="Future scope">
          <p>
            Expand the regional catalog, add file scanning and complete real-device verification.
            Future audio and video can use the existing room and membership model. Supporting minors
            would require a separate safeguarding design.
          </p>
        </Section>
      </div>
    </>
  );
}
