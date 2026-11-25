# StudyCircle presentation

Start on the dashboard. Explain why students can struggle to ask for help and how exchanging strengths can help. Walk through matching, private study and feedback before opening Project overview.

| Time | Show |
| --- | --- |
| 0:00–0:45 | Problem, audience and home dashboard |
| 0:45–2:30 | Eigenvalues match, acceptance and two-user chat |
| 2:30–3:45 | Anonymous question and accepted explanation |
| 3:45–4:45 | Shared Pomodoro and stored study records |
| 4:45–5:45 | Report one item and inspect the staff audit |
| 5:45–7:00 | Database relationships, installation and privacy controls |

## Faculty questions

**Where is the backend?** GitHub Pages serves the browser application. Supabase handles Auth, PostgreSQL, realtime updates, private files and privileged functions.

**How is compatibility calculated?** A compatible subject contributes 45 points. Topic contributes 20, education level, language and availability contribute 10 each, and an eligible local cohort contributes five. Every result explains its score.

**Can someone trace a peer's address?** Both people opt into a region. The database checks a five-peer minimum and restricts local area changes for the day. Students never see an individual's coordinates or exact distance.

**How do reviews stay anonymous?** The database accepts one submission per entitlement. The recipient gets a private aggregate from three different reviewers. Delayed notes exclude names, timestamps and study-session links.

**How does a moderator see chat?** The report stores the selected item. Opening it and deciding the case create audit entries. Chat authorization otherwise follows participant membership.

**Are the figures real?** The live workspace aggregates stored focus logs, room attendance and completed sessions. The classroom tour uses fictional events.

**What remains for a pilot?** Validate Auth delivery and the complete live stack, rehearse installed use on physical devices, and establish institutional retention and file scanning. The local seed also ran in a disposable PostgreSQL 17 instance.
