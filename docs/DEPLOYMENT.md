# Deployment and rehearsal

## Hosted Supabase

1. Create a fresh Supabase project. Enable email signup and confirmation, set a minimum password length of 10 and disable anonymous and unused providers. Configure SMTP for independent real email addresses. For a free classroom rehearsal, use the local Supabase mailbox. [Supabase SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp)
2. Authenticate the Supabase CLI, then link the intended project with `supabase link --project-ref YOUR_PROJECT_REF`. Use `supabase db push --remote` on CLI versions with explicit environment selection. On older versions use `supabase db push` against the linked project. Apply migrations only and leave the local seed excluded. [Supabase CLI targeting](https://supabase.com/docs/guides/local-development/local-and-hosted-projects)
3. Deploy `question-file` and `delete-account` using `supabase functions deploy FUNCTION_NAME --no-verify-jwt`. The functions independently verify caller tokens. Supabase supplies server credentials to its runtime.
4. Set the Auth Site URL to the final Pages root with trailing slash. Add the same URL and any authorized local origins to the redirect allowlist. Use the default email templates for the same-browser PKCE flow. [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
5. Configure the public URL and publishable key in `.env.local` and register the intended first administrator through the app. A project owner can grant the role from the SQL Editor:

   ```sql
   insert into public.user_roles(user_id, role)
   values ('REPLACE_WITH_VERIFIED_USER_UUID', 'admin')
   on conflict do nothing;
   ```

## GitHub Pages

1. Push the source to the approved repository after authorization. Choose **GitHub Actions** in **Settings → Pages**.
2. Set repository Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Both are public client values.
3. Manually dispatch **Publish StudyCircle to GitHub Pages**. Choose `live` for the configured Supabase backend or `classroom-demo` for the labelled fictional workspace. The workflow verifies the app and uploads the static build to the `github-pages` environment.

## Optional browser push

Generate VAPID keys once with `npx web-push generate-vapid-keys`. Set the Edge Function secrets `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_CONTACT` (a valid mailto address or HTTPS URL) and a separately generated high-entropy `WEB_PUSH_DISPATCH_SECRET`. Only the VAPID public key belongs in the Pages variable `VITE_WEB_PUSH_PUBLIC_KEY`. Deploy `dispatch-push` with `--no-verify-jwt`. It validates its dedicated bearer before claiming pending deliveries.

In Supabase Cron, schedule an HTTP POST to the deployed `dispatch-push` function every few minutes. Store the dedicated bearer in Supabase Vault and send it in the Authorization header. The dispatcher sends generic alerts for unread in-app notifications to opted-in devices. Test in the production preview over localhost or on the approved HTTPS site. Reminders are generated when the app is open.

## Verify on the approved URL

- Open the project root and refresh a hash route, then register and verify two independent accounts.
- Accept a request in one browser profile and watch for a message and attachment in the other.
- Start a shared timer with two members and check that both display the same phase.
- Install on Android and add to the Home Screen on iOS. After the first load, try reopening while offline.
- Check Auth redirects and SMTP logs if mail confirmation fails.

The service worker only caches the public offline page. Use the Supabase dashboard for authentication, database health, backups and platform logs. The CI integration job starts a disposable local Supabase stack.
