import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Backend, MutationBuilder, QueryBuilder, Row, TableApi } from './backend';

/**
 * Supabase backend. `@supabase/supabase-js` already speaks the query
 * surface declared in backend.ts, so this is a thin adapter that binds a
 * request-scoped client (cookies → session → auth.uid()).
 *
 * Every query made through it runs as the signed-in user, so Row Level
 * Security in supabase/migrations/0002_rls.sql is what actually decides
 * what comes back. There is no application-level ownership check to fall
 * back on, and none is needed.
 */
class SupabaseTable implements TableApi {
  constructor(
    private client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
    private table: string,
  ) {}

  select<T = Row>(columns = '*'): QueryBuilder<T> {
    return this.client.from(this.table).select(columns) as unknown as QueryBuilder<T>;
  }
  insert<T = Row>(rows: Row | Row[]): MutationBuilder<T> {
    return this.client.from(this.table).insert(rows) as unknown as MutationBuilder<T>;
  }
  upsert<T = Row>(rows: Row | Row[], options?: { onConflict?: string }): MutationBuilder<T> {
    return this.client
      .from(this.table)
      .upsert(rows, options ? { onConflict: options.onConflict } : undefined) as unknown as MutationBuilder<T>;
  }
  update<T = Row>(values: Row): MutationBuilder<T> {
    return this.client.from(this.table).update(values) as unknown as MutationBuilder<T>;
  }
  delete(): MutationBuilder<never> {
    return this.client.from(this.table).delete() as unknown as MutationBuilder<never>;
  }
}

let cached: Backend | null = null;

export async function supabaseBackend(): Promise<Backend> {
  if (cached) return cached;
  const client = await createSupabaseServerClient();

  cached = {
    kind: 'supabase',
    async uid() {
      const { data } = await client.auth.getUser();
      return data.user?.id ?? null;
    },
    from(table: string) {
      return new SupabaseTable(client, table);
    },
    rpc<T = Row>(fn: string, args?: Row) {
      return client.rpc(fn, args) as unknown as Promise<{
        data: T[] | null;
        error: { message: string; code?: string } | null;
      }>;
    },
  };
  return cached;
}
