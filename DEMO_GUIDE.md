# Classroom walkthrough

Start the frontend with `npm run dev`. Without Supabase keys, the header identifies the fictional workspace and switches student perspectives. The single-tab rehearsal resets on refresh. For a two-device, database-backed demonstration, run the local Supabase seed or use authorized accounts on an isolated hosted project.

## Six scenarios

1. **Peer learning.** As Maya, open Connect. Select Linear Algebra, Eigenvalues and eigenvectors, Undergraduate, English and Weekday evenings. Find Ishaan and send a request. Switch to Ishaan, open Requests and accept. Exchange messages and reopen the conversation as Maya.
2. **Nearby discovery.** Start a fresh tour or use an unused account pair. Choose the Approximate 5 km preference. The tour uses a simplified fictional Bengaluru cohort. The local Supabase seed has five opted-in Linear Algebra mentors and uses the actual threshold and area lock. Show the manual area selector in Privacy.
3. **Community learning.** Open Communities → Questions and select the aircraft stability question. Maya owns the seeded anonymous question. Mark the explanation helpful and accept it. To show a new post, submit an original question and have Ishaan reply.
4. **Collaborative study.** Open Study → Rooms → Linear Algebra Revision Circle in the tour. Mark Maya ready and start a shared Pomodoro. Switch to Ishaan and mark ready. Choose a Custom 1-minute study and 1-minute break for a short attendance rehearsal. The local seed contains the same room. Open it from two browser profiles to show the shared database timer.
5. **Moderation.** The fictional room contains one rude message. As Maya, report it from the room chat. Switch to Leena and open Moderation. Open the reported item, choose Hide and show the audit log. Leena has a limited moderator role.
6. **Anonymous review.** Have both peers confirm completion. Submit Maya's feedback. The form closes when the entitlement is used. The recipient's private aggregate remains pending until three different peers provide feedback.

## Local Supabase seed accounts

Maya, Ishaan, Nia, Arjun and Leena can sign in with their lowercase first name followed by `@classroom.example`. Use the fixture password defined in `supabase/seed.sql`. Keep these accounts in the local Supabase project. For a live nearby walkthrough, sign in as Maya and select Approximate 5 km before trying another local area.
