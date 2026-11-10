export type HiveData = Record<string, unknown>;

export interface HiveQuery {
  /** op: ==, !=, <, <=, >, >= or array-contains */
  where(field: string, op: string, value: unknown): HiveQuery;
  orderBy(field: string, dir?: 'asc' | 'desc'): HiveQuery;
  limit(n: number): HiveQuery;
  get(): Promise<unknown>;
}

export interface HiveDoc {
  get(): Promise<unknown>;
  set(data: HiveData): Promise<unknown>;
  /** Merges fields. */
  update(data: HiveData): Promise<unknown>;
  delete(): Promise<unknown>;
}

export interface HiveCollection extends HiveQuery {
  add(data: HiveData): Promise<unknown>;
  doc(id: string): HiveDoc;
}

export interface HiveDBClient {
  /** Set after signIn(). */
  address?: string;
  /** Player sign-in with a wallet signature. */
  signIn(wallet?: unknown): Promise<unknown>;
  myName(address?: string): Promise<{ own: string | null; sub: string | null; choice: string | null; shown: string | null }>;
  useName(which: 'own' | 'sub'): Promise<unknown>;
  bees(): Promise<unknown>;
  /** The owner's signed key-value settings. */
  settings(): Promise<Record<string, string>>;
  col(name: string): HiveCollection;
  [key: string]: unknown;
}

export function HiveDB(name: string, options?: { api?: string }): HiveDBClient;
