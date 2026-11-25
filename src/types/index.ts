export interface Row {
  id?: string;
  [field: string]: any;
}
export type Filter = Record<string, string | number | boolean>;
export type Query = { where?: Filter; order?: string; desc?: boolean; limit?: number };
export interface DataStore {
  list: (table: string, query?: Query) => Promise<Row[]>;
  rpc: <T = any>(name: string, args?: Row) => Promise<T>;
  insert: (table: string, data: Row) => Promise<void>;
  update: (table: string, where: Filter, data: Row) => Promise<void>;
  remove: (table: string, where: Filter) => Promise<void>;
  subscribe: (table: string, fn: () => void, where?: Filter) => () => void;
  upload: (bucket: string, prefix: string, file: File) => Promise<string>;
  discard: (bucket: string, path: string) => Promise<void>;
  open: (bucket: string, path: string) => Promise<string>;
}
