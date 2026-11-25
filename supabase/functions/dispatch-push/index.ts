import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { reply } from '../_shared/access.ts';

Deno.serve(async (req) => {
  const secret = Deno.env.get('WEB_PUSH_DISPATCH_SECRET');
  if (req.method !== 'POST' || !secret || req.headers.get('Authorization') !== 'Bearer ' + secret)
    return reply({ error: 'Unauthorized' }, 401);
  const publicKey = Deno.env.get('WEB_PUSH_PUBLIC_KEY');
  const privateKey = Deno.env.get('WEB_PUSH_PRIVATE_KEY');
  const contact = Deno.env.get('WEB_PUSH_CONTACT');
  if (!publicKey || !privateKey || !contact)
    return reply({ error: 'VAPID configuration is incomplete' }, 503);
  const server = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await server.rpc('claim_push_batch');
  if (error) return reply({ error: 'Could not claim push queue' }, 500);
  let finalized = 0;
  await Promise.all(
    (data || []).map(
      async (item: {
        id: string;
        notification_id: string;
        endpoint: string;
        device_key: string;
        device_secret: string;
      }) => {
        let outcome = 'delivered';
        try {
          await webpush.sendNotification(
            {
              endpoint: item.endpoint,
              keys: { p256dh: item.device_key, auth: item.device_secret },
            },
            JSON.stringify({ id: item.notification_id }),
            { TTL: 60, timeout: 7000, vapidDetails: { subject: contact, publicKey, privateKey } },
          );
        } catch (error) {
          const status = Number((error as { statusCode?: number })?.statusCode);
          outcome = [404, 410].includes(status)
            ? 'expired'
            : [400, 401, 403, 413].includes(status)
              ? 'rejected'
              : 'retry';
        }
        const result = await server.rpc('finish_push_attempt', { delivery: item.id, outcome });
        if (!result.error) finalized++;
      },
    ),
  );
  return reply({ claimed: data?.length || 0, finalized });
});
