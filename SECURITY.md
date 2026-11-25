# Privacy and security

StudyCircle uses Supabase Auth, database roles, row-level security and checked SQL functions for shared state. The 18+ gate is an attestation enforced when the auth account is created. Hosting controls email confirmation and delivery. Staff privileges are database records.

## Location and contact

Local search requires opt-in from both sides and uses a region catalog, a five-peer eligible cohort, a daily region lock and rate limits. Radius selections map to named regions. The browser uses device coordinates briefly to suggest a region and never sends them to the database. Accepted requests and group memberships authorize chat. Declining starts a contact cooldown. Blocking prevents direct messages and matches and hides blocked authors in shared chat.

## Data access and moderation

Optional browser push stores device endpoints and encryption keys in an internal table. The dispatcher sends a generic payload and uses a restricted browser-provider allowlist and a dedicated server bearer.

Messages remain durable until account or conversation deletion. An authorized case can hide a message while retaining it for moderation and appeals. Moderation evidence snapshots contain the specified item and stay accessible through an audited staff-only function. Report views, assignments and decisions generate audit events. The student export covers their application records and authored content from supported tables. Audits retain actions after actor deletion with their identity reference removed. Community contributions can remain after account deletion with an anonymous or detached author.

Review identity and text stay outside the general client table API. A recipient sees a private numeric summary after three distinct reviewers. Notes appear privately after a 24-hour delay and require three eligible reviewers, with identity, timestamps and session links removed. Entitlements are limited to one per person per session and one per pair and direction per 30 days.

## Files and deletion

Storage buckets are private. Authorized downloads use short-lived signed URLs. Q&A files have opaque identifiers and require an authenticated download function. Uploads accept PDF, PNG, JPEG and text files with an 8 MB cap. The browser checks file signatures for supported binary formats. Storage enforces media type, file size and access. The MVP has no server-side malware scanning. Remove names and identifying metadata from files before sharing them anonymously.

Account deletion uses a verified session and explicit confirmation. The deletion function stops routine writes, removes owned files through Storage and then removes the auth account. Partial failure allows the owner to retry the operation. Supabase backups can retain older data according to project policy.

## Operating limits

Rule-based checks cover a small set of prohibited phrases and unsafe links in chat. Reports support human review. Set operating retention and appeal policies before admitting real students. The MVP has no automated message or audit-log expiry. Serve the app over HTTPS. Store service keys only in trusted server or isolated test environments.
