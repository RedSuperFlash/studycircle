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
    if ((await req.json()).confirm !== 'DELETE')
      return reply({ error: 'Confirmation required' }, 400);
    const { user, server } = identity;
    const paused = await server.rpc('begin_account_deletion', { actor: user.id });
    if (paused.error) throw paused.error;
    for (const bucket of ['study-resources', 'study-question-files', 'study-attachments']) {
      // Owner-scoped paths come from PostgreSQL. Delete through Storage to remove the object bytes.
      for (let page = 0; page < 100; page++) {
        const paths = await server.rpc('account_object_paths', { actor: user.id, bucket });
        if (paths.error) throw paths.error;
        if (!paths.data.length) break;
        const removed = await server.storage.from(bucket).remove(paths.data);
        if (removed.error) throw removed.error;
        if (page === 99)
          return reply(
            { error: 'File cleanup is incomplete. Retry to finish account deletion.' },
            409,
          );
      }
    }
    const { error } = await server.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return reply({ deleted: true });
  } catch (error) {
    console.error('Account deletion failed', String(error));
    return reply({ error: 'Account deletion did not finish. Retry to complete cleanup.' }, 500);
  }
});
