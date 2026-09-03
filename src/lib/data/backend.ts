/* ------------------------------------------------------------------ *
 * Data backend contract.
 *
 * The app talks to the database through a very small subset of the
 * supabase-js query surface. That deliberate restriction means the same
 * repository code runs against two backends:
 *
 *   • supabase  — production, via @supabase/supabase-js and Supabase Auth
 *   • demo      — an in-memory store used when no Supabase project is
 *                 configured, so the app can be run and reviewed without
 *                 credentials (NEXT_PUBLIC_DEMO=1, or env vars absent)
 *
 * Domain queries live in lib/data/repository.ts and are written once.
 * ------------------------------------------------------------------ */

export type Row = Record<string, unknown>;

export interface QueryError {
  message: string;
  code?: string;
}

export interface QueryResult<T> {
  data: T | null;
  error: QueryError | null;
}

export interface OrderOptions {
  ascending?: boolean;
}

export interface QueryBuilder<T = Row> extends PromiseLike<QueryResult<T[]>> {
  eq(column: string, value: unknown): QueryBuilder<T>;
  neq(column: string, value: unknown): QueryBuilder<T>;
  in(column: string, values: readonly unknown[]): QueryBuilder<T>;
  gte(column: string, value: unknown): QueryBuilder<T>;
  gt(column: string, value: unknown): QueryBuilder<T>;
  lte(column: string, value: unknown): QueryBuilder<T>;
  lt(column: string, value: unknown): QueryBuilder<T>;
  is(column: string, value: null | boolean): QueryBuilder<T>;
  ilike(column: string, pattern: string): QueryBuilder<T>;
  order(column: string, options?: OrderOptions): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  single(): PromiseLike<QueryResult<T>>;
  maybeSingle(): PromiseLike<QueryResult<T>>;
}

export interface MutationBuilder<T = Row> extends PromiseLike<QueryResult<T[]>> {
  select(columns?: string): MutationBuilder<T>;
  single(): PromiseLike<QueryResult<T>>;
  maybeSingle(): PromiseLike<QueryResult<T>>;
  eq(column: string, value: unknown): MutationBuilder<T>;
  in(column: string, values: readonly unknown[]): MutationBuilder<T>;
}

export interface TableApi {
  select<T = Row>(columns?: string): QueryBuilder<T>;
  insert<T = Row>(rows: Row | Row[]): MutationBuilder<T>;
  upsert<T = Row>(rows: Row | Row[], options?: { onConflict?: string }): MutationBuilder<T>;
  update<T = Row>(values: Row): MutationBuilder<T>;
  delete(): MutationBuilder<never>;
}

export interface Backend {
  /** Stable id of the signed-in user, or null when there is none. */
  uid(): Promise<string | null>;
  from(table: string): TableApi;
  rpc<T = Row>(fn: string, args?: Row): PromiseLike<QueryResult<T[]>>;
  readonly kind: 'supabase' | 'demo';
}

export function unwrap<T>(result: QueryResult<T[]>): T[] {
  if (result.error) {
    // Surface the database's own message server-side; the caller decides
    // what, if anything, reaches the browser.
    throw new Error(`[data] ${result.error.message}`);
  }
  return result.data ?? [];
}

export function unwrapOne<T>(result: QueryResult<T>): T | null {
  if (result.error) {
    if (result.error.code === 'PGRST116') return null;
    throw new Error(`[data] ${result.error.message}`);
  }
  return result.data ?? null;
}

/**
 * `maybeSingle()` without the ceremony. Most repository reads want "the one
 * row matching these filters, or nothing" and should not have to think about
 * the difference between an empty result and an error.
 */
export async function firstRow(builder: {
  maybeSingle(): PromiseLike<QueryResult<Row>>;
}): Promise<Row | null> {
  const result = await builder.maybeSingle();
  if (result.error) throw new Error(`[data] ${result.error.message}`);
  return result.data ?? null;
}
