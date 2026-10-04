import 'server-only';
import {Pool, types, type PoolClient} from 'pg';
import {databaseConnectionOptions} from '@/lib/database-config.mjs';

// Epoch seconds and aggregate counts fit safely in a JavaScript number.
types.setTypeParser(20, Number);
const state = globalThis as unknown as {francoRoutePool?: Pool};
function pool() {
  if (state.francoRoutePool) return state.francoRoutePool;
  state.francoRoutePool = new Pool({
    ...databaseConnectionOptions(), max: 1, idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 7000, query_timeout: 15000,
  });
  state.francoRoutePool.on('error', () => console.error('Database connection interrupted'));
  return state.francoRoutePool;
}

class Statement {
  values: unknown[] = [];
  constructor(readonly sql: string) {}
  bind(...values: unknown[]) {const result = new Statement(this.sql); result.values = values; return result;}
  async query(client: Pool | PoolClient = pool()) {
    let index = 0;
    // Only application-owned SQL literals reach this adapter. Values remain parameterized.
    const text = this.sql.replace(/\?/g, () => '$' + (++index));
    if (index !== this.values.length) throw new Error('Invalid SQL parameter count');
    // No named statements: compatible with Supabase's transaction pooler.
    return client.query(text, this.values);
  }
  async first<T = Record<string, any>>(): Promise<T | null> {return (await this.query()).rows[0] ?? null;}
  async all() {return {results: (await this.query()).rows};}
  async run() {return {meta: {changes: (await this.query()).rowCount ?? 0}};}
}
export function db() {
  return {
    prepare: (sql: string) => new Statement(sql),
    async batch(statements: Statement[]) {
      const client = await pool().connect();
      try {
        await client.query('BEGIN');
        const results = [];
        for (const statement of statements) results.push({results: (await statement.query(client)).rows});
        await client.query('COMMIT');
        return results;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {client.release();}
    },
  };
}

// Transactions use one checked-out connection, including advisory and row locks.
export async function transaction<T>(fn: (query: (sql: string, values?: unknown[]) => Promise<any[]>) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(async (sql, values = []) => (await client.query(sql, values)).rows);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
