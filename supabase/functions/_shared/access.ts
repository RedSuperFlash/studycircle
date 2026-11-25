import { createClient } from 'npm:@supabase/supabase-js@2';
const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });
export async function access(req: Request) {
  const token = req.headers.get('Authorization');
  if (!token?.startsWith('Bearer ')) throw new Error('Missing session');
  const auth = createClient(url, anon, {
    global: { headers: { Authorization: token } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await auth.auth.getUser(token.slice(7));
  if (error || !data.user?.email_confirmed_at) throw new Error('Valid verified session required');
  const server = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { auth, user: data.user, server };
}
