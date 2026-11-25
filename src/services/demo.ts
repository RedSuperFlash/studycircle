import { isoDay } from '../lib/format';
import type { DataStore, Filter, Row } from '../types';

export const demoPeople: Row[] = [
  {
    id: 'maya',
    name: 'Maya Rao',
    alias: 'Student-Orbit',
    avatar: 'iris',
    course_id: 'aero',
    education_id: 'undergrad',
    language: 'English',
    identifiable: true,
    display_name: 'Maya Rao',
    study_year: 1,
  },
  {
    id: 'ishaan',
    name: 'Ishaan Mehta',
    alias: 'Student-Vector',
    avatar: 'fern',
    course_id: 'math',
    education_id: 'undergrad',
    language: 'English',
    identifiable: true,
    display_name: 'Ishaan Mehta',
    study_year: 2,
  },
  {
    id: 'nia',
    name: 'Nia Fernandes',
    avatar: 'sun',
    course_id: 'cs',
    education_id: 'undergrad',
    language: 'English',
    identifiable: true,
    display_name: 'Nia Fernandes',
  },
  {
    id: 'arjun',
    name: 'Arjun Sen',
    avatar: 'sky',
    course_id: 'physics',
    education_id: 'undergrad',
    language: 'English',
    identifiable: true,
    display_name: 'Arjun Sen',
  },
  {
    id: 'leena',
    name: 'Leena Shah',
    avatar: 'iris',
    education_id: 'undergrad',
    language: 'English',
    identifiable: true,
    display_name: 'Leena Shah',
  },
];
const stamp = () => new Date().toISOString();
const catalog = (items: string[][]) => items.map(([id, name]) => ({ id, name }));
const subjects = catalog([
  ['math', 'Engineering Mathematics'],
  ['linear', 'Linear Algebra'],
  ['physics', 'Physics'],
  ['chemistry', 'Chemistry'],
  ['aero', 'Aerospace Engineering'],
  ['cs', 'Computer Science'],
  ['programming', 'Programming'],
  ['bio', 'Biology'],
]);
const badges = [
  ['first', 'First Step', 'Complete a personal study task'],
  ['helpful', 'Helpful Peer', 'Receive a helpful vote'],
  ['study-buddy', 'Study Buddy', 'Complete a peer session'],
  ['contributor', 'Community Contributor', 'Share a resource'],
  ['consistent', 'Consistent Learner', 'Log focus time on three days'],
  ['team', 'Team Player', 'Log a group focus session'],
  ['revision', 'Revision Champion', 'Complete an exam topic'],
].map(([id, name, description]) => ({ id, name, description }));
const tables: Record<string, Row[]> = {
  profiles: demoPeople.map((p) => ({ ...p })),
  private_profiles: demoPeople.map((p) => ({
    user_id: p.id,
    region_id: 'bengaluru',
    location_opt_in: true,
  })),
  student_preferences: demoPeople.map((p) => ({
    user_id: p.id,
    muted_categories: [],
    learning_method: p.id === 'maya' ? 'Worked examples' : '',
  })),
  student_availability: demoPeople.map((p) => ({ user_id: p.id, slot: 'Weekday evenings' })),
  institutions: catalog([
    ['other', 'Other institution'],
    ['skyline', 'Skyline Institute of Technology (fictional)'],
  ]),
  education_levels: catalog([
    ['undergrad', 'Undergraduate'],
    ['postgrad', 'Postgraduate'],
    ['diploma', 'Diploma'],
  ]),
  courses: catalog([
    ['aero', 'Aerospace Engineering'],
    ['cs', 'Computer Science'],
    ['math', 'Mathematics'],
    ['physics', 'Physics'],
    ['other', 'Other'],
  ]),
  subjects,
  topics: [
    { id: 'eigen', subject_id: 'linear', name: 'Eigenvalues and eigenvectors' },
    { id: 'stability', subject_id: 'aero', name: 'Flight stability' },
    { id: 'dynamics', subject_id: 'physics', name: 'Dynamics' },
  ],
  geographic_regions: [
    { id: 'india', name: 'India', kind: 'country' },
    { id: 'karnataka', name: 'Karnataka', kind: 'state' },
    { id: 'bengaluru', name: 'Bengaluru', kind: 'city' },
    { id: 'jayanagar', name: 'Jayanagar', kind: 'neighbourhood' },
  ],
  student_subjects: [
    { user_id: 'maya', subject_id: 'linear', mode: 'learn', topic: 'Eigenvalues and eigenvectors' },
    { user_id: 'maya', subject_id: 'aero', mode: 'mentor', topic: 'Flight mechanics' },
    {
      user_id: 'ishaan',
      subject_id: 'linear',
      mode: 'mentor',
      topic: 'Eigenvalues and eigenvectors',
    },
    { user_id: 'nia', subject_id: 'cs', mode: 'mentor', topic: 'Algorithms' },
    { user_id: 'arjun', subject_id: 'physics', mode: 'mentor', topic: 'Dynamics' },
  ],
  communities: [
    {
      id: 'linear',
      name: 'Linear Algebra',
      subject_id: 'linear',
      category: 'Subject',
      description: 'Build intuition for matrices, vector spaces and eigenvalues.',
    },
    {
      id: 'aero',
      name: 'Aerospace Engineering',
      subject_id: 'aero',
      category: 'Subject',
      description: 'From flight dynamics to designing better aircraft.',
    },
    {
      id: 'cs',
      name: 'Computer Science',
      subject_id: 'cs',
      category: 'Subject',
      description: 'Trade ideas about algorithms, programming and systems.',
    },
    {
      id: 'physics',
      name: 'Physics Lab',
      subject_id: 'physics',
      category: 'Subject',
      description: 'Make sense of the science behind how things move.',
    },
    {
      id: 'bengaluru',
      name: 'Bengaluru Students',
      category: 'Local',
      description: 'A local circle for students to learn together.',
    },
    {
      id: 'exams',
      name: 'Exam Preparation',
      category: 'Exam',
      description: 'Plan revision and trade original practice questions.',
    },
  ],
  community_members: [
    { community_id: 'linear', user_id: 'maya' },
    { community_id: 'linear', user_id: 'ishaan' },
    { community_id: 'aero', user_id: 'maya' },
  ],
  community_channels: [
    { id: 'general', community_id: 'linear', name: 'General' },
    { id: 'eigen', community_id: 'linear', name: 'Eigenvalues' },
  ],
  community_posts: [
    {
      id: 'seed-post',
      community_id: 'linear',
      channel_id: 'general',
      author_id: 'ishaan',
      title: 'An intuitive way to picture a matrix',
      body: 'Imagine drawing a unit square and transforming its corners. Which directions stretch without rotating?',
      created_at: stamp(),
      pinned: true,
    },
  ],
  questions: [
    {
      id: 'stability-q',
      author_id: null,
      owner: 'maya',
      subject_id: 'aero',
      title: 'How do eigenvalues determine aircraft stability?',
      body: 'I understand eigenvalues in matrices. How do real and complex parts translate into what an aircraft does after a disturbance?',
      topic: 'Flight dynamics',
      answer_count: 2,
      created_at: stamp(),
    },
    {
      id: 'transform-q',
      author_id: 'nia',
      subject_id: 'linear',
      title: 'Why do similar matrices have the same eigenvalues?',
      body: 'Can someone explain the change-of-basis idea with a small example?',
      topic: 'Matrices',
      answer_count: 0,
      created_at: stamp(),
    },
  ],
  answers: [
    {
      id: 'stability-a',
      question_id: 'stability-q',
      author_id: 'ishaan',
      body: 'A mode follows $e^{\\lambda t}$. The real part of $\\lambda$ controls growth or decay. A negative real part gives decay. The imaginary part sets the oscillation frequency.',
      helpful_count: 6,
      created_at: stamp(),
    },
    {
      id: 'stability-b',
      question_id: 'stability-q',
      author_id: 'arjun',
      body: 'Start with the linearized system $\\dot{x}=Ax$. A disturbance aligned with a mode shows you how that mode evolves over time.',
      helpful_count: 3,
      created_at: stamp(),
    },
  ],
  resources: [
    {
      id: 'formulas',
      author_id: 'ishaan',
      subject_id: 'linear',
      category: 'Formula sheet',
      title: 'Linear algebra quick reference',
      description:
        'Definitions and worked examples for eigenvectors, characteristic polynomials and diagonalization.',
      url: 'https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/',
      created_at: stamp(),
    },
  ],
  study_tasks: [
    {
      id: 't1',
      user_id: 'maya',
      title: 'Review eigenvalues and eigenvectors',
      subject_id: 'linear',
      due_on: isoDay(),
      priority: 'High',
      kind: 'Revision',
      done: false,
      created_at: stamp(),
    },
    {
      id: 't2',
      user_id: 'maya',
      title: 'Outline flight dynamics notes',
      subject_id: 'aero',
      due_on: isoDay(),
      priority: 'Normal',
      kind: 'Study',
      done: false,
      created_at: stamp(),
    },
    {
      id: 't3',
      user_id: 'maya',
      title: 'Complete matrix transformations',
      subject_id: 'linear',
      due_on: isoDay(),
      priority: 'Normal',
      kind: 'Revision',
      done: true,
      created_at: stamp(),
    },
  ],
  study_goals: [
    {
      id: 'g1',
      user_id: 'maya',
      title: 'Get comfortable with diagonalization',
      subject_id: 'linear',
      target_on: isoDay(6),
      done: false,
    },
  ],
  examinations: [
    {
      id: 'ex1',
      user_id: 'maya',
      title: 'Linear Algebra midterm',
      subject_id: 'linear',
      exam_on: isoDay(6),
    },
    {
      id: 'ex2',
      user_id: 'maya',
      title: 'Flight Mechanics quiz',
      subject_id: 'aero',
      exam_on: isoDay(12),
    },
  ],
  exam_topics: [
    { id: 'et1', user_id: 'maya', exam_id: 'ex1', title: 'Characteristic polynomials', done: true },
    { id: 'et2', user_id: 'maya', exam_id: 'ex1', title: 'Diagonalization', done: false },
  ],
  focus_logs: [30, 45, 25, 66, 37, 30, 20].map((minutes, index) => ({
    id: 'focus' + index,
    user_id: 'maya',
    subject_id: index % 2 ? 'aero' : 'linear',
    minutes,
    created_at: isoDay(index - 6) + 'T12:00:00',
  })),
  flashcard_decks: [
    {
      id: 'd1',
      user_id: 'maya',
      subject_id: 'linear',
      title: 'Linear algebra foundations',
      created_at: stamp(),
    },
  ],
  flashcards: [
    {
      id: 'f1',
      deck_id: 'd1',
      front: 'What is an eigenvector?',
      back: 'A nonzero vector whose direction line stays unchanged under a linear transformation.',
    },
    {
      id: 'f2',
      deck_id: 'd1',
      front: 'When is a matrix diagonalizable?',
      back: 'When it has a basis of linearly independent eigenvectors.',
    },
  ],
  quizzes: [
    {
      id: 'qz1',
      user_id: 'maya',
      subject_id: 'linear',
      title: 'Eigenvalues practice',
      created_at: stamp(),
    },
  ],
  quiz_questions: [
    {
      id: 'qq1',
      quiz_id: 'qz1',
      prompt: 'What does an eigenvalue of 2 do to a corresponding eigenvector?',
      options: ['Doubles it', 'Rotates it 90°', 'Sets it to zero', 'Reflects it'],
      position: 1,
      correct: 0,
      explanation: 'An eigenvalue is the scale factor for its corresponding eigenvector.',
    },
  ],
  study_groups: [
    {
      id: 'room1',
      owner_id: 'maya',
      subject_id: 'linear',
      name: 'Linear Algebra Revision Circle',
      description: 'Practice eigenvalue problems together.',
      topic: 'Eigenvalues',
      category: 'Subject revision',
      capacity: 8,
      privacy: 'Open',
      format: 'Online',
      created_at: stamp(),
    },
  ],
  study_group_members: [
    { group_id: 'room1', user_id: 'maya', status: 'active' },
    { group_id: 'room1', user_id: 'ishaan', status: 'active' },
  ],
  study_rooms: [{ id: 'room1', objective: 'Solve two characteristic polynomial examples.' }],
  room_tasks: [
    {
      id: 'rt1',
      room_id: 'room1',
      title: 'Find the eigenvalues of a triangular matrix',
      done: false,
    },
  ],
  conversations: [{ id: 'room1', title: 'Linear Algebra Revision Circle' }],
  conversation_participants: [
    { conversation_id: 'room1', user_id: 'maya' },
    { conversation_id: 'room1', user_id: 'ishaan' },
  ],
  messages: [
    {
      id: 'seed-msg',
      conversation_id: 'room1',
      author_id: 'ishaan',
      body: 'That question is stupid. Stop wasting our time.',
      created_at: stamp(),
    },
  ],
  notifications: [
    {
      id: 'not1',
      user_id: 'maya',
      title: 'Your question has a new answer',
      category: 'community',
      href: '/communities?tab=Questions',
      created_at: stamp(),
    },
  ],
  badges,
  user_badges: [{ user_id: 'maya', badge_id: 'first' }],
};
const observers = new Map<string, Set<() => void>>();
const files = new Map<string, string>();
const data = (t: string) => tables[t] ?? (tables[t] = []);
const matches = (row: Row, where: Filter = {}) =>
  Object.entries(where).every(([k, v]) => row[k] === v);
const emit = (t: string) => observers.get(t)?.forEach((f) => f());
function add(t: string, row: Row) {
  const result = { id: crypto.randomUUID(), created_at: stamp(), ...row };
  data(t).push(result);
  emit(t);
  return result;
}
function required(row: Row | undefined, message = 'That record is unavailable.'): Row {
  if (!row) throw new Error(message);
  return row;
}
const mine = new Set([
  'private_profiles',
  'matchmaking_queue',
  'student_subjects',
  'student_preferences',
  'student_availability',
  'study_tasks',
  'study_goals',
  'examinations',
  'exam_topics',
  'focus_logs',
  'quiz_attempts',
  'flashcard_reviews',
  'notifications',
  'blocked_users',
  'resource_bookmarks',
  'resource_reactions',
  'answer_reactions',
  'question_bookmarks',
  'post_bookmarks',
  'user_badges',
  'moderation_appeals',
  'moderation_actions',
]);
const isStaff = (id: string) => id === 'leena';
const blocked = (a: string, b: string) =>
  data('blocked_users').some(
    (r) => (r.owner_id === a && r.blocked_id === b) || (r.owner_id === b && r.blocked_id === a),
  );
const hasChat = (id: string, chat: string) =>
  data('conversation_participants').some((r) => r.user_id === id && r.conversation_id === chat);
const notify = (id: string, category: string, title: string, href: string) => {
  if (
    !data('student_preferences')
      .find((p) => p.user_id === id)
      ?.muted_categories.includes(category)
  )
    add('notifications', { user_id: id, category, title, href });
};
async function action(user: string, name: string, a: Row): Promise<any> {
  const get = (t: string, id: string) => data(t).find((r) => r.id === id);
  const edit = (t: string, id: string, v: Row) => {
    Object.assign(required(get(t, id)), v);
    emit(t);
  };
  switch (name) {
    case 'my_role':
      return isStaff(user) ? 'moderator' : 'student';
    case 'person': {
      const p = get('profiles', a.person_id);
      return p && !blocked(user, a.person_id)
        ? [
            {
              id: p.id,
              name: p.identifiable ? p.display_name : p.alias,
              avatar: p.avatar,
              education_id: p.education_id,
              institution_id: p.identifiable ? p.institution_id : null,
              bio: p.identifiable ? p.bio : null,
            },
          ]
        : [];
    }
    case 'my_review_summary':
      return [];
    case 'my_review_notes':
      return [];
    case 'sync_reminders':
      return;
    case 'server_clock':
      return stamp();
    case 'chat_signal': {
      const r = data('chat_presence').find(
        (p) => p.conversation_id === a.chat && p.user_id === user,
      );
      if (r) {
        r.seen_at = stamp();
        if (a.typing) r.typing_at = stamp();
        emit('chat_presence');
      } else
        add('chat_presence', {
          conversation_id: a.chat,
          user_id: user,
          seen_at: stamp(),
          typing_at: a.typing ? stamp() : null,
        });
      return;
    }
    case 'set_location':
      Object.assign(required(data('private_profiles').find((r) => r.user_id === user)), {
        region_id: a.region,
        location_opt_in: a.discoverable,
      });
      return;
    case 'find_partners': {
      if (
        !['online', 'worldwide'].includes(a.scope) &&
        !data('private_profiles').find((r) => r.user_id === user)?.location_opt_in
      )
        throw new Error('Enable local discovery in your profile first.');
      tables.matchmaking_queue = data('matchmaking_queue').filter((r) => r.user_id !== user);
      add('matchmaking_queue', { ...a, user_id: user, subject_id: a.subject, updated_at: stamp() });
      return data('student_subjects')
        .filter(
          (r) =>
            r.user_id !== user &&
            r.subject_id === a.subject &&
            (!['Offer help', 'Get help', 'Topic revision'].includes(a.intent) ||
              r.mode === (a.intent === 'Offer help' ? 'learn' : 'mentor')) &&
            !blocked(user, r.user_id) &&
            !data('study_requests').some(
              (s) =>
                ['pending', 'declined'].includes(s.status) &&
                [s.sender_id, s.recipient_id].includes(user) &&
                [s.sender_id, s.recipient_id].includes(r.user_id),
            ),
        )
        .map((r) => {
          const p = required(get('profiles', r.user_id));
          const reasons = [
            (a.intent === 'Offer help' ? 'Needs help with ' : 'Can help with ') +
              get('subjects', a.subject)?.name,
          ];
          let score = 45;
          if (a.topic && a.topic.toLowerCase() === r.topic.toLowerCase()) {
            score += 20;
            reasons.push('Matches your topic');
          }
          if (p.education_id === a.level) {
            score += 10;
            reasons.push('Same education level');
          }
          if (p.language === a.preferred_language) {
            score += 10;
            reasons.push('Speaks ' + p.language);
          }
          if (
            data('student_availability').some((s) => s.user_id === r.user_id && s.slot === a.slot)
          ) {
            score += 10;
            reasons.push('Available in your preferred time window');
          }
          if (!['online', 'worldwide'].includes(a.scope)) {
            score += 5;
            reasons.push('In your fictional Bengaluru cohort');
          }
          return { id: p.id, name: p.display_name || p.alias, avatar: p.avatar, score, reasons };
        })
        .sort((x, y) => y.score - x.score);
    }
    case 'send_request': {
      if (
        blocked(user, a.target) ||
        a.target === user ||
        data('study_requests').some(
          (r) =>
            r.status === 'pending' &&
            [r.sender_id, r.recipient_id].includes(a.target) &&
            [r.sender_id, r.recipient_id].includes(user),
        )
      )
        throw new Error('A request cannot be sent to this student.');
      const r = add('study_requests', {
        sender_id: user,
        recipient_id: a.target,
        subject_id: a.subject,
        intent: a.purpose,
        status: 'pending',
      });
      notify(a.target, 'requests', 'New study request', '/connect?tab=Requests');
      return r.id;
    }
    case 'respond_request': {
      const r = required(get('study_requests', a.request));
      if (
        r.status !== 'pending' ||
        (a.decision === 'cancelled' ? r.sender_id !== user : r.recipient_id !== user)
      )
        throw new Error('This request cannot be changed.');
      edit('study_requests', a.request, { status: a.decision });
      if (a.decision !== 'accepted') return null;
      const s = add('study_sessions', {
        request_id: r.id,
        subject_id: r.subject_id,
        started_at: stamp(),
      });
      add('conversations', { id: s.id, session_id: s.id, title: 'Peer study' });
      [r.sender_id, r.recipient_id].forEach((user_id) => {
        add('session_participants', { session_id: s.id, user_id });
        add('conversation_participants', { conversation_id: s.id, user_id });
      });
      if (r.intent === 'Accountability')
        add('accountability_partnerships', { session_id: s.id, status: 'active' });
      notify(r.sender_id, 'requests', 'Study request accepted', '/connect?tab=Messages');
      return s.id;
    }
    case 'send_message': {
      if (
        !hasChat(user, a.chat) ||
        data('conversation_participants').some(
          (p) => p.conversation_id === a.chat && blocked(user, p.user_id),
        )
      )
        throw new Error('Conversation access denied.');
      const m = add('messages', {
        conversation_id: a.chat,
        author_id: user,
        body: a.content,
        reply_to: a.reply,
      });
      if (a.file_path)
        add('message_attachments', { message_id: m.id, path: a.file_path, label: a.file_label });
      data('conversation_participants')
        .filter((p) => p.conversation_id === a.chat && p.user_id !== user && !p.muted)
        .forEach((p) =>
          notify(p.user_id, 'messages', 'New study message', '/connect?tab=Messages'),
        );
      return m.id;
    }
    case 'complete_session': {
      const s = required(get('study_sessions', a.session));
      const members = data('session_participants').filter((p) => p.session_id === a.session);
      required(members.find((p) => p.user_id === user)).confirmed_at = stamp();
      if (s.completed_at) return true;
      if (!members.every((p) => p.confirmed_at)) return false;
      edit('study_sessions', a.session, {
        completed_at: stamp(),
        minutes: Math.floor((Date.now() - Date.parse(s.started_at)) / 60000),
      });
      for (const p of members)
        add('review_eligibility', {
          session_id: a.session,
          reviewer_id: p.user_id,
          recipient_id: members.find((m) => m !== p)?.user_id,
        });
      return true;
    }
    case 'submit_review': {
      const r = required(
        data('review_eligibility').find(
          (p) => p.session_id === a.session && p.reviewer_id === user && !p.used_at,
        ),
        'Feedback is unavailable or already submitted.',
      );
      r.used_at = stamp();
      emit('review_eligibility');
      return;
    }
    case 'update_partnership':
      edit('accountability_partnerships', a.partnership, {
        goal: a.new_goal,
        check_in: a.new_check_in,
        status: a.new_status,
      });
      return;
    case 'my_questions':
      return data('questions')
        .filter((r) => (r.owner ?? r.author_id) === user)
        .map((r) => r.id);
    case 'post_question': {
      if (
        data('questions').some(
          (r) =>
            !r.hidden &&
            r.subject_id === a.subject &&
            r.title.toLowerCase() === a.title_text.trim().toLowerCase(),
        )
      )
        throw new Error('A question with this title already exists.');
      return add('questions', {
        owner: user,
        author_id: a.anonymous ? null : user,
        title: a.title_text,
        body: a.body_text,
        subject_id: a.subject,
        topic: a.topic_text,
        community_id: a.community,
        education_id: a.level,
        answer_count: 0,
        attachment_path: a.file_path,
        attachment_label: a.file_label,
      }).id;
    }
    case 'add_answer': {
      const q = required(get('questions', a.question));
      const r = add('answers', {
        question_id: a.question,
        author_id: user,
        body: a.content,
        helpful_count: 0,
        attachment_path: a.file_path,
        attachment_label: a.file_label,
      });
      edit('questions', a.question, { answer_count: q.answer_count + 1 });
      if (q.owner && q.owner !== user)
        notify(
          q.owner,
          'community',
          'Your question has a new answer',
          '/communities?tab=Questions',
        );
      return r.id;
    }
    case 'accept_answer': {
      const q = required(get('questions', a.question));
      if ((q.owner ?? q.author_id) !== user || get('answers', a.answer)?.question_id !== a.question)
        throw new Error('Only the question author can accept an answer.');
      edit('questions', a.question, { accepted_answer_id: a.answer });
      return;
    }
    case 'toggle_helpful': {
      const x = required(get('answers', a.answer));
      if (x.author_id === user) throw new Error('You cannot vote for your own answer.');
      const i = data('answer_reactions').findIndex(
        (r) => r.answer_id === a.answer && r.user_id === user,
      );
      if (i < 0) add('answer_reactions', { answer_id: a.answer, user_id: user });
      else data('answer_reactions').splice(i, 1);
      edit('answers', a.answer, { helpful_count: x.helpful_count + (i < 0 ? 1 : -1) });
      return;
    }
    case 'publish_post':
      return add('community_posts', {
        author_id: user,
        community_id: a.community,
        title: a.title_text,
        body: a.body_text,
        channel_id: a.channel,
        poll_options: a.options,
      }).id;
    case 'add_comment':
      add(a.kind === 'post' ? 'community_comments' : 'answer_comments', {
        author_id: user,
        body: a.content,
        ...(a.kind === 'post'
          ? { post_id: a.target, reply_to: a.parent }
          : { answer_id: a.target }),
      });
      return;
    case 'vote_poll':
      tables.poll_votes = data('poll_votes').filter(
        (r) => r.user_id !== user || r.post_id !== a.post,
      );
      add('poll_votes', { user_id: user, post_id: a.post, choice: a.option_number });
      return;
    case 'poll_results':
      return Object.entries(
        data('poll_votes')
          .filter((r) => r.post_id === a.post)
          .reduce<Record<string, number>>(
            (s, r) => ({ ...s, [r.choice]: (s[r.choice] || 0) + 1 }),
            {},
          ),
      ).map(([choice, votes]) => ({ choice: Number(choice), votes }));
    case 'publish_resource':
      return add('resources', {
        author_id: user,
        title: a.title_text,
        description: a.details,
        subject_id: a.subject,
        category: a.kind,
        topic: a.topic_text,
        education_id: a.level,
        course_id: a.course,
        institution_id: a.institution,
        exam: a.exam_text,
        path: a.object_path,
        url: a.external_url,
      }).id;
    case 'resource_helpful':
      return data('resource_reactions').filter((r) => r.resource_id === a.resource).length;
    case 'create_group': {
      const g = add('study_groups', {
        owner_id: user,
        name: a.group_name,
        description: a.details,
        subject_id: a.subject,
        topic: a.topic_text,
        category: a.kind,
        capacity: a.max_members,
        privacy: a.access,
        format: a.meeting_format,
      });
      add('study_rooms', { id: g.id, objective: a.details });
      add('study_group_members', { group_id: g.id, user_id: user, status: 'active' });
      add('conversations', { id: g.id, title: a.group_name });
      add('conversation_participants', { conversation_id: g.id, user_id: user });
      return g.id;
    }
    case 'group_membership': {
      const g = required(get('study_groups', a.team));
      const person = a.member ?? user;
      const previous = data('study_group_members').find(
        (r) => r.group_id === a.team && r.user_id === person,
      );
      if (a.decision === 'leave') {
        tables.study_group_members = data('study_group_members').filter((r) => r !== previous);
        tables.conversation_participants = data('conversation_participants').filter(
          (r) => r.conversation_id !== a.team || r.user_id !== person,
        );
        return;
      }
      const status =
        a.decision === 'invite'
          ? 'invited'
          : g.privacy === 'Approval' && a.decision === 'join' && previous?.status !== 'invited'
            ? 'pending'
            : 'active';
      if (g.privacy === 'Invitation' && a.decision === 'join' && !previous)
        throw new Error('An invitation is required.');
      if (
        data('study_group_members').filter((r) => r.group_id === a.team && r.status === 'active')
          .length >= g.capacity &&
        !previous
      )
        throw new Error('This group is full.');
      if (previous) previous.status = status;
      else add('study_group_members', { group_id: a.team, user_id: person, status });
      if (status === 'active' && !hasChat(person, a.team))
        add('conversation_participants', { conversation_id: a.team, user_id: person });
      return;
    }
    case 'room_ready': {
      const r = data('study_room_participants').find(
        (r) => r.room_id === a.room && r.user_id === user,
      );
      if (r) r.ready = a.ready_state;
      else add('study_room_participants', { room_id: a.room, user_id: user, ready: a.ready_state });
      emit('study_room_participants');
      return;
    }
    case 'start_timer':
      return add('study_timers', {
        room_id: a.room,
        started_at: stamp(),
        study_minutes: a.study_length,
        break_minutes: a.break_length,
      }).id;
    case 'room_task':
      if (a.task_id) edit('room_tasks', a.task_id, { done: a.completed });
      else add('room_tasks', { room_id: a.room, title: a.task_title, done: false });
      return;
    case 'schedule_room':
      edit('study_rooms', a.room, { objective: a.objective_text, scheduled_at: a.starts });
      return;
    case 'announce':
      add('group_announcements', { group_id: a.team, body: a.content });
      return;
    case 'log_room_attendance': {
      const t = required(get('study_timers', a.timer));
      if ((Date.now() - Date.parse(t.started_at)) / 60000 < t.study_minutes)
        throw new Error('The focus interval is still running.');
      if (
        !data('study_room_participants').some(
          (r) => r.room_id === t.room_id && r.user_id === user && r.ready,
        )
      )
        throw new Error('Mark yourself ready first.');
      if (!data('room_attendance').some((r) => r.user_id === user && r.timer_id === a.timer)) {
        add('room_attendance', { user_id: user, timer_id: a.timer, minutes: t.study_minutes });
        add('focus_logs', { user_id: user, minutes: t.study_minutes });
      }
      return t.study_minutes;
    }
    case 'review_card':
      add('flashcard_reviews', {
        user_id: user,
        card_id: a.card,
        difficulty: a.rating,
        reviewed_at: stamp(),
        next_review_at: isoDay(a.rating === 'Easy' ? 7 : a.rating === 'Medium' ? 3 : 1),
      });
      return;
    case 'add_quiz_item':
      add('quiz_questions', {
        quiz_id: a.quiz,
        prompt: a.prompt_text,
        options: a.choices,
        correct: a.correct,
        explanation: a.explanation_text,
        position: data('quiz_questions').filter((r) => r.quiz_id === a.quiz).length + 1,
      });
      return;
    case 'grade_quiz': {
      const results = data('quiz_questions')
        .filter((r) => r.quiz_id === a.quiz)
        .map((r) => ({
          prompt: r.prompt,
          chosen: r.options[a.selections[r.id!]],
          correct: r.options[r.correct],
          ok: a.selections[r.id!] === r.correct,
          explanation: r.explanation,
        }));
      return add('quiz_attempts', {
        user_id: user,
        quiz_id: a.quiz,
        results,
        total: results.length,
        score: results.filter((r) => r.ok).length,
      }).id;
    }
    case 'report_content': {
      const targetTable: Record<string, string> = {
        message: 'messages',
        question: 'questions',
        answer: 'answers',
        post: 'community_posts',
        resource: 'resources',
        user: 'profiles',
      };
      const item = required(get(targetTable[a.kind], a.item));
      if (a.kind === 'message' && !hasChat(user, item.conversation_id))
        throw new Error('Conversation access denied.');
      const r = add('reports', {
        reporter_id: user,
        target_type: a.kind,
        target_id: a.item,
        category: a.classification,
        reason: a.details,
        content: item.body ?? item.description ?? item.alias,
        table: targetTable[a.kind],
        status: 'pending',
      });
      add('moderation_cases', { report_id: r.id, status: 'open' });
      return r.id;
    }
    case 'claim_report': {
      if (!isStaff(user)) throw new Error('Moderator access required.');
      const c = required(
        data('moderation_cases').find((c) => c.report_id === a.ticket && c.status === 'open'),
      );
      c.assigned_to = user;
      add('audit_logs', { actor_id: user, action: 'Claimed report', reference: a.ticket });
      return;
    }
    case 'inspect_report': {
      if (!isStaff(user)) throw new Error('Moderator access required.');
      add('audit_logs', { actor_id: user, action: 'Read reported item', reference: a.ticket });
      return [{ content: required(get('reports', a.ticket)).content }];
    }
    case 'resolve_report': {
      if (!isStaff(user)) throw new Error('Moderator access required.');
      const r = required(get('reports', a.ticket));
      if (r.status !== 'pending') throw new Error('Report already resolved.');
      if (a.decision === 'hide' && r.target_type !== 'user')
        edit(r.table, r.target_id, { hidden: true });
      edit('reports', a.ticket, { status: a.decision === 'dismiss' ? 'dismissed' : 'resolved' });
      Object.assign(required(data('moderation_cases').find((c) => c.report_id === a.ticket)), {
        status: 'closed',
        assigned_to: user,
      });
      add('moderation_actions', {
        actor_id: user,
        user_id: get(r.table, r.target_id)?.author_id,
        action: a.decision,
        note: a.explanation,
      });
      add('audit_logs', {
        actor_id: user,
        action: 'Resolved report (' + a.decision + ')',
        reference: a.ticket,
      });
      return;
    }
    case 'admin_action':
      if (isStaff(user) && a.kind === 'post') {
        edit('community_posts', a.item, { pinned: a.action === 'pin' });
        return;
      }
      throw new Error('Administrator access required.');
    case 'appeal_action':
      add('moderation_appeals', {
        user_id: user,
        action_id: a.action_id,
        body: a.details,
        status: 'pending',
      });
      return;
    case 'request_verification':
      throw new Error('Institutional verification uses a real Supabase email account.');
    case 'refresh_badges': {
      const earned = [
        data('study_tasks').some((r) => r.done && r.user_id === user) && 'first',
        data('answers').some((r) => r.author_id === user && r.helpful_count > 0) && 'helpful',
        data('session_participants').some(
          (r) => r.user_id === user && get('study_sessions', r.session_id)?.completed_at,
        ) && 'study-buddy',
        data('resources').some((r) => r.author_id === user) && 'contributor',
        new Set(
          data('focus_logs')
            .filter((r) => r.user_id === user)
            .map((r) => r.created_at.slice(0, 10)),
        ).size >= 3 && 'consistent',
        data('room_attendance').some((r) => r.user_id === user) && 'team',
        data('exam_topics').some((r) => r.user_id === user && r.done) && 'revision',
      ];
      earned.filter(Boolean).forEach((badge_id) => {
        if (!data('user_badges').some((r) => r.user_id === user && r.badge_id === badge_id))
          add('user_badges', { user_id: user, badge_id });
      });
      return;
    }
    case 'my_analytics': {
      const completed = data('session_participants')
        .filter((r) => r.user_id === user && get('study_sessions', r.session_id)?.completed_at)
        .map((r) => get('study_sessions', r.session_id)!);
      return {
        sessions: completed.length,
        questions: data('questions').filter((r) => (r.owner ?? r.author_id) === user).length,
        answers: data('answers').filter((r) => r.author_id === user).length,
        goals: data('study_goals').filter((r) => r.user_id === user && r.done).length,
        flashcards: new Set(
          data('flashcard_reviews')
            .filter((r) => r.user_id === user)
            .map((r) => r.card_id),
        ).size,
        activity: [
          ...data('focus_logs')
            .filter((r) => r.user_id === user)
            .map((r) => ({
              day: r.created_at.slice(0, 10),
              subject_id: r.subject_id,
              minutes: r.minutes,
            })),
          ...completed.map((r) => ({
            day: r.completed_at.slice(0, 10),
            subject_id: r.subject_id,
            minutes: r.minutes,
          })),
        ],
      };
    }
    case 'my_data_export':
      return Object.fromEntries(
        [...mine].map((t) => [t, data(t).filter((r) => r.user_id === user || r.owner_id === user)]),
      );
    default:
      throw new Error('This operation requires a configured Supabase project.');
  }
}

export function demoStore(user: string): DataStore {
  return {
    async list(t, q) {
      let rows = data(t).filter((r) => !r.hidden && matches(r, q?.where));
      if (t === 'chat_unread')
        rows = data('conversation_participants')
          .filter((p) => p.user_id === user)
          .map((p) => ({
            user_id: user,
            conversation_id: p.conversation_id,
            unread: data('messages').filter(
              (m) =>
                m.conversation_id === p.conversation_id &&
                m.author_id !== user &&
                !m.hidden &&
                m.created_at > (p.last_read_at || ''),
            ).length,
          }));
      if (t === 'chat_presence')
        rows = rows.filter((p) => hasChat(user, p.conversation_id) && !blocked(user, p.user_id));
      if (t === 'flashcard_decks' || t === 'quizzes')
        rows = rows.filter(
          (p) =>
            p.user_id === user ||
            data('community_members').some(
              (m) => m.user_id === user && m.community_id === p.community_id,
            ),
        );
      if (mine.has(t)) rows = rows.filter((r) => r.user_id === user || r.owner_id === user);
      if (t === 'profiles') rows = rows.filter((r) => r.id === user);
      if (t === 'study_requests')
        rows = rows.filter((r) => [r.sender_id, r.recipient_id].includes(user));
      if (t === 'session_participants')
        rows = rows.filter((r) =>
          data(t).some((p) => p.session_id === r.session_id && p.user_id === user),
        );
      if (t === 'review_eligibility') rows = rows.filter((r) => r.reviewer_id === user);
      if (t === 'study_sessions' || t === 'accountability_partnerships')
        rows = rows.filter((r) => hasChat(user, r.session_id ?? r.id));
      if (t === 'conversations') rows = rows.filter((r) => hasChat(user, r.id!));
      if (t === 'messages' || t === 'conversation_participants')
        rows = rows.filter(
          (r) => hasChat(user, r.conversation_id) && (!r.author_id || !blocked(user, r.author_id)),
        );
      if (t === 'message_attachments')
        rows = rows.filter((r) =>
          data('messages').some(
            (m) => m.id === r.message_id && !m.hidden && hasChat(user, m.conversation_id),
          ),
        );
      if (t === 'reports' && !isStaff(user)) rows = rows.filter((r) => r.reporter_id === user);
      if (['moderation_cases', 'audit_logs'].includes(t) && !isStaff(user)) rows = [];
      if (q?.order) {
        const key = q.order;
        rows.sort(
          (a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * (q.desc ? -1 : 1),
        );
      }
      return structuredClone(q?.limit ? rows.slice(0, q.limit) : rows);
    },
    rpc: (name, args = {}) => action(user, name, args),
    async insert(t, row) {
      if (!data(t).some((r) => matches(r, row))) add(t, { user_id: user, ...row });
    },
    async update(t, where, row) {
      data(t)
        .filter((r) => matches(r, where))
        .forEach((r) => Object.assign(r, row));
      emit(t);
    },
    async remove(t, where) {
      tables[t] = data(t).filter((r) => !matches(r, where));
      emit(t);
    },
    subscribe(t, fn) {
      if (!observers.has(t)) observers.set(t, new Set());
      observers.get(t)!.add(fn);
      return () => {
        observers.get(t)?.delete(fn);
      };
    },
    async upload(bucket, prefix, file) {
      if (file.size > 8 * 1024 * 1024) throw new Error('The file exceeds 8 MB.');
      const path = prefix + '/' + crypto.randomUUID();
      files.set(bucket + path, URL.createObjectURL(file));
      return path;
    },
    async discard(bucket, path) {
      const url = files.get(bucket + path);
      if (url) URL.revokeObjectURL(url);
      files.delete(bucket + path);
    },
    async open(bucket, path) {
      return required(
        files.has(bucket + path) ? { url: files.get(bucket + path) } : undefined,
        'The file is unavailable.',
      ).url;
    },
  };
}
