import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { DataStore, Query, Row } from '../types';
import { errorText } from '../lib/format';
export const Workspace = createContext<{
  db: DataStore;
  user: string;
  demo: boolean;
  role: string;
  revision: number;
  refresh: () => void;
} | null>(null);
export function useWorkspace() {
  const ctx = useContext(Workspace);
  if (!ctx) throw new Error('Workspace required');
  return ctx;
}
export function useData<T>(load: (db: DataStore) => Promise<T>, key: string, fallback: T) {
  const { db, revision } = useWorkspace();
  const [state, setState] = useState<{ data: T; loading: boolean; error: string; key: string }>({
    data: fallback,
    loading: true,
    error: '',
    key,
  });
  const [tick, reload] = useState(0);
  useEffect(() => {
    let current = true;
    setState((prev) =>
      prev.key === key ? { ...prev, error: '' } : { data: fallback, loading: true, error: '', key },
    );
    load(db).then(
      (data) => {
        if (current) setState({ data, loading: false, error: '', key });
      },
      (error) => {
        if (current)
          setState((prev) => ({ ...prev, error: errorText(error), loading: false, key }));
      },
    );
    return () => {
      current = false;
    };
    // The semantic key represents query dependencies.
  }, [db, key, revision, tick]);
  return {
    ...(state.key === key ? state : { data: fallback, loading: true, error: '', key }),
    reload: () => reload((n) => n + 1),
  };
}
export function useRows(table: string, query?: Query, live = false) {
  const key = table + JSON.stringify(query || {});
  const rows = useData((db) => db.list(table, query), key, [] as Row[]);
  const { db } = useWorkspace();
  useEffect(
    () => (live ? db.subscribe(table, rows.reload, query?.where) : undefined),
    [db, key, live],
  );
  return rows;
}
export function useRPC<T>(name: string, args: Row | undefined, fallback: T) {
  return useData((db) => db.rpc<T>(name, args), name + JSON.stringify(args || {}), fallback);
}
export function useAction() {
  const { refresh } = useWorkspace();
  const [status, setStatus] = useState({ busy: false, error: '', notice: '' });
  const run = async (task: () => Promise<unknown>, notice = '') => {
    if (status.busy) return false;
    setStatus({ busy: true, error: '', notice: '' });
    try {
      await task();
      refresh();
      setStatus({ busy: false, error: '', notice });
      return true;
    } catch (error) {
      setStatus({ busy: false, error: errorText(error), notice: '' });
      return false;
    }
  };
  return { ...status, run };
}
export function WorkspaceProvider({
  db,
  user,
  demo,
  role,
  children,
}: {
  db: DataStore;
  user: string;
  demo: boolean;
  role: string;
  children: ReactNode;
}) {
  const [revision, setRevision] = useState(0);
  return (
    <Workspace.Provider
      value={{ db, user, demo, role, revision, refresh: () => setRevision((n) => n + 1) }}
    >
      {children}
    </Workspace.Provider>
  );
}
