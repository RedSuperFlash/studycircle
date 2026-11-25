import { supabase } from '../lib/supabase';
import type { DataStore, Filter } from '../types';
export const attachmentAccept = '.pdf,.png,.jpg,.jpeg,.txt';
export const liveStore = (): DataStore => {
  const client = supabase;
  if (!client) throw new Error('Configure a Supabase URL and public key first.');
  const apply = <T>(builder: T, filters?: Filter): T => {
    for (const [key, value] of Object.entries(filters || {}))
      (builder as unknown as { eq: (key: string, value: Filter[string]) => unknown }).eq(
        key,
        value,
      );
    return builder;
  };
  return {
    async list(table, options) {
      let query = apply(client.from(table).select('*'), options?.where);
      if (options?.order) query = query.order(options.order, { ascending: !options.desc });
      if (options?.limit) query = query.limit(options.limit);
      const result = await query;
      if (result.error) throw result.error;
      return result.data;
    },
    async rpc(name, args) {
      const { data, error } = await client.rpc(name, args);
      if (error) throw error;
      return data;
    },
    async insert(table, data) {
      const { error } = await client.from(table).insert(data);
      if (error) throw error;
    },
    async update(table, where, data) {
      const { error } = await apply(client.from(table).update(data), where);
      if (error) throw error;
    },
    async remove(table, where) {
      const { error } = await apply(client.from(table).delete(), where);
      if (error) throw error;
    },
    subscribe(table, fn, where) {
      const first = Object.entries(where || {})[0];
      const channel = client
        .channel(table + ':' + crypto.randomUUID())
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            ...(first ? { filter: first[0] + '=eq.' + first[1] } : {}),
          },
          fn,
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') fn();
        });
      return () => {
        void client.removeChannel(channel);
      };
    },
    async upload(bucket, prefix, file) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const types: Record<string, string> = {
        pdf: 'application/pdf',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        txt: 'text/plain',
      };
      if (!types[ext] || file.size > 8 * 1024 * 1024 || file.size < 1)
        throw new Error('Choose a PDF, PNG, JPEG or text file of up to 8 MB.');
      const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const signature = Array.from(bytes).join(',');
      if (
        (ext === 'pdf' && !signature.startsWith('37,80,68,70,45')) ||
        (ext === 'png' && !signature.startsWith('137,80,78,71,13,10,26,10')) ||
        (['jpg', 'jpeg'].includes(ext) && !signature.startsWith('255,216,255')) ||
        (ext === 'txt' && bytes.includes(0))
      )
        throw new Error('The file content does not match its extension.');
      const path = prefix + '/' + crypto.randomUUID() + '.' + ext;
      const { error } = await client.storage
        .from(bucket)
        .upload(path, file, { contentType: types[ext], upsert: false });
      if (error) throw error;
      return path;
    },
    async discard(bucket, path) {
      const { error } = await client.storage.from(bucket).remove([path]);
      if (error) throw error;
    },
    async open(bucket, path) {
      if (bucket === 'study-question-files') {
        const { data, error } = await client.functions.invoke('question-file', { body: { path } });
        if (error)
          throw new Error(
            'The attachment could not be opened. Check the question-file function configuration.',
          );
        return data.url;
      }
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(path, 45, { download: 'studycircle-file.' + path.split('.').pop() });
      if (error) throw error;
      return data.signedUrl;
    },
  };
};
