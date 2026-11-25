import { access, cors, reply } from '../_shared/access.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  let identity;
  try {
    identity = await access(req);
  } catch {
    return reply({ error: 'Sign in with a verified account' }, 401);
  }
  try {
    const { path } = await req.json();
    if (
      typeof path !== 'string' ||
      !/^questions\/[0-9a-f-]{36}\.(pdf|png|jpg|jpeg|txt)$/.test(path)
    )
      return reply({ error: 'Invalid file' }, 400);
    const { data, error } = await identity.auth
      .from('questions')
      .select('id')
      .eq('attachment_path', path)
      .maybeSingle();
    if (error) return reply({ error: 'File unavailable' }, 404);
    if (!data) {
      const answer = await identity.auth
        .from('answers')
        .select('id')
        .eq('attachment_path', path)
        .maybeSingle();
      if (answer.error || !answer.data) return reply({ error: 'File unavailable' }, 404);
    }
    const signed = await identity.server.storage
      .from('study-question-files')
      .createSignedUrl(path, 30, { download: 'studycircle-attachment.' + path.split('.').pop() });
    if (signed.error) return reply({ error: 'File unavailable' }, 404);
    return reply({ url: signed.data.signedUrl });
  } catch {
    return reply({ error: 'File unavailable' }, 404);
  }
});
