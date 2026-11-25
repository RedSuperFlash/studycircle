import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { test, expect, type Page } from '@playwright/test';

const authUrl = process.env.E2E_SUPABASE_URL!;
const publicKey = process.env.E2E_SUPABASE_KEY!;
const adminKey = process.env.E2E_SUPABASE_SERVICE_KEY!;
const pass = 'Classroom-QA-Only!38';
const authOptions = { persistSession: false, autoRefreshToken: false };
const login = async (page: Page, email: string) => {
  await page.goto('/');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(pass);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible();
};
test('real email registration, separate user sessions, realtime, Storage and authorization', async ({
  browser,
}) => {
  const staff = createClient(authUrl, adminKey, { auth: authOptions });
  const members: { email: string; client: SupabaseClient; id: string }[] = [];
  const createdIds: string[] = [];
  for (const role of ['learner', 'mentor', 'outside']) {
    const email = role + '-' + randomUUID() + '@example.com';
    const client = createClient(authUrl, publicKey, { auth: authOptions });
    const registration = await client.auth.signUp({
      email,
      password: pass,
      options: { data: { adult: true } },
    });
    expect(registration.error).toBeNull();
    const id = registration.data.user!.id;
    createdIds.push(id);
    expect(registration.data.session).toBeNull();
    // The test harness confirms delivery through the service API. Browser login uses the public key.
    expect((await staff.auth.admin.updateUserById(id, { email_confirm: true })).error).toBeNull();
    expect((await client.auth.signInWithPassword({ email, password: pass })).error).toBeNull();
    members.push({ email, client, id });
  }
  const [learner, mentor, outside] = members;
  const a = await browser.newContext(),
    b = await browser.newContext();
  try {
    const pageA = await a.newPage(),
      pageB = await b.newPage();
    expect(
      (
        await mentor.client
          .from('student_subjects')
          .insert({
            user_id: mentor.id,
            subject_id: 'linear',
            mode: 'mentor',
            topic: 'Eigenvalues and eigenvectors',
          })
      ).error,
    ).toBeNull();
    await Promise.all([login(pageA, learner.email), login(pageB, mentor.email)]);
    await pageA.goto('/#/connect');
    await pageA.getByLabel('Subject', { exact: true }).selectOption('linear');
    await pageA.getByLabel('Topic', { exact: true }).fill('Eigenvalues and eigenvectors');
    await pageA.getByRole('button', { name: 'Find study partners' }).click();
    const matches = pageA.locator('.match-card');
    const ownMatch = matches.filter({
      hasText: (await mentor.client.from('profiles').select('alias').single()).data!.alias,
    });
    await ownMatch.getByRole('button', { name: 'Send study request' }).click();
    await expect(pageA.getByText('Study request sent.')).toBeVisible();
    await pageB.goto('/#/connect?tab=Requests');
    await pageB.getByRole('button', { name: 'Accept request' }).click();
    const chat = await pageB
      .getByLabel('Message', { exact: true })
      .waitFor()
      .then(() => new URLSearchParams(new URL(pageB.url()).hash.split('?')[1]).get('chat')!);
    await pageA.goto('/#/connect?tab=Messages&chat=' + chat);
    await expect(pageA.getByLabel('Message', { exact: true })).toBeVisible();
    await pageB
      .getByLabel('Message', { exact: true })
      .fill('This arrives from an independent browser.');
    await pageB
      .locator('input[type=file]')
      .setInputFiles({
        name: 'example.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Original study notes.'),
      });
    await pageB.getByRole('button', { name: 'Send message' }).click();
    await expect(pageA.getByText('This arrives from an independent browser.')).toBeVisible({
      timeout: 15000,
    });
    // Storage metadata may arrive after the message event. Reopening reads the durable row.
    await pageA.reload();
    await expect(pageA.getByRole('button', { name: 'Prepare example.txt' })).toBeVisible();
    await pageA.getByRole('button', { name: 'Prepare example.txt' }).click();
    await expect(pageA.getByRole('link', { name: 'example.txt' })).toHaveAttribute(
      'href',
      /\/storage\/v1\/object\/sign/,
    );
    expect(
      (await outside.client.from('messages').select('*').eq('conversation_id', chat)).data,
    ).toEqual([]);
    expect((await outside.client.rpc('admin_metrics')).error?.message).toMatch(/Administrator/);
  } finally {
    await Promise.all([a.close(), b.close()]);
    for (const id of createdIds) {
      const response = await staff.rpc('account_object_paths', {
        actor: id,
        bucket: 'study-attachments',
      });
      if (response.data?.length)
        await staff.storage.from('study-attachments').remove(response.data);
      await staff.auth.admin.deleteUser(id);
    }
  }
});
