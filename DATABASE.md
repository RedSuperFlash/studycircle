# StudyCircle database

The SQL files in `supabase/migrations` are the source of truth. Run them in order. Catalog rows are migration data. Fictional students belong to the local seed only.

| Area | Main records |
| --- | --- |
| Identity | Auth users, profiles, private profiles, roles, consent, institution, course and education level |
| Discovery | Subjects, topics, student subjects, preferences, availability, geographic regions and queues |
| Peer study | Requests, sessions, participants, conversations, chat presence, messages and attachments |
| Communities | Communities, channels, memberships, posts, comments, polls and bookmarks |
| Academic Q&A | Questions, private ownership, answers, comments and reactions |
| Group study | Groups, memberships, rooms, tasks, timers, attendance, announcements and shared resources |
| Study tools | Tasks, goals, exams, revision topics, focus logs, decks, cards, reviews, quizzes and attempts |
| Safety | Review entitlements, anonymous feedback, blocks, reports, cases, audit logs and appeals |
| Operations | Notifications, verification, badges and application settings |

```mermaid
erDiagram
  PROFILES ||--o{ STUDENT_SUBJECTS : selects
  SUBJECTS ||--o{ STUDENT_SUBJECTS : categorizes
  PROFILES ||--o{ STUDY_REQUESTS : sends
  STUDY_REQUESTS ||--o| STUDY_SESSIONS : creates
  STUDY_SESSIONS ||--|| CONVERSATIONS : opens
  STUDY_SESSIONS ||--o{ SESSION_PARTICIPANTS : includes
  CONVERSATIONS ||--o{ MESSAGES : contains
  MESSAGES ||--o{ MESSAGE_ATTACHMENTS : links
  STUDY_SESSIONS ||--o{ REVIEW_ELIGIBILITY : grants
  REVIEW_ELIGIBILITY ||--o| REVIEWS : permits
  COMMUNITIES ||--o{ COMMUNITY_MEMBERS : receives
  COMMUNITIES ||--o{ COMMUNITY_POSTS : contains
  QUESTIONS ||--o{ ANSWERS : receives
  ANSWERS ||--o{ ANSWER_REACTIONS : receives
  STUDY_GROUPS ||--|| STUDY_ROOMS : hosts
  STUDY_ROOMS ||--o{ STUDY_TIMERS : runs
  STUDY_TIMERS ||--o{ ROOM_ATTENDANCE : records
  FLASHCARD_DECKS ||--o{ FLASHCARDS : contains
  QUIZZES ||--o{ QUIZ_QUESTIONS : contains
  QUIZZES ||--o{ QUIZ_ATTEMPTS : scores
  REPORTS ||--|| MODERATION_CASES : opens
  MODERATION_CASES ||--o{ MODERATION_ACTIONS : records
```

A request acceptance transaction creates the session, participant rows and conversation. Completion, eligibility and review submission use locked rows. An anonymous question has a null public author and an owner mapping in the internal schema. Timers store their start time and durations. Quiz answer keys stay in the internal schema. Attempt results store the explanations at grading time.
