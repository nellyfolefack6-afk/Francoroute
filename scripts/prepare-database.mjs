import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const files = ['schema.sql', 'outlook-pratique.sql'];

export function preparationMode(env, args = []) {
  // A deploy preview must never initialize or migrate the production database.
  if (env.NETLIFY === 'true' && env.CONTEXT !== 'production') return 'preview';
  if (env.NETLIFY !== 'true' && !args.includes('--apply')) return 'local';
  if (!env.DATABASE_URL) return 'unconfigured';
  return 'apply';
}

export function connectionOptions(env) {
  const url = new URL(env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL_INVALID');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  return {
    connectionString: url.toString(), connectionTimeoutMillis: 10000,
    query_timeout: 45000,
    ssl: {rejectUnauthorized: true, ...(env.DATABASE_CA_CERT
      ? {ca: env.DATABASE_CA_CERT.replace(/\\n/g, '\n')} : {})},
  };
}

export async function migrations() {
  return Promise.all(files.map(async name => {
    const source = await readFile(new URL('../supabase/' + name, import.meta.url), 'utf8');
    // The versioned files have a single outer transaction; the runner owns it.
    if ((source.match(/^BEGIN;\s*$/gm) || []).length !== 1 ||
        (source.match(/^COMMIT;\s*$/gm) || []).length !== 1) throw new Error('MIGRATION_INVALID');
    return {name, checksum: createHash('sha256').update(source).digest('hex'),
      sql: source.replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '')};
  }));
}

export async function runMigrations(client, entries, log = console.log) {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '15s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query('SELECT pg_advisory_xact_lock(74032602)');
    await client.query(`CREATE TABLE IF NOT EXISTS public.francoroute_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    await client.query('ALTER TABLE public.francoroute_migrations ENABLE ROW LEVEL SECURITY');
    await client.query('REVOKE ALL ON public.francoroute_migrations FROM PUBLIC, anon, authenticated');
    for (const entry of entries) {
      const {rows} = await client.query('SELECT checksum FROM public.francoroute_migrations WHERE name=$1', [entry.name]);
      if (rows.length) {
        if (rows[0].checksum !== entry.checksum) throw new Error('MIGRATION_CHANGED');
        continue;
      }
      await client.query(entry.sql);
      await client.query('INSERT INTO public.francoroute_migrations(name,checksum) VALUES($1,$2)', [entry.name, entry.checksum]);
    }
    await client.query('COMMIT');
    log('FrancoRoute : tables de reservation et Outlook pretes ; donnees existantes conservees.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

export async function prepareDatabase(env = process.env, args = process.argv.slice(2), log = console.log) {
  const mode = preparationMode(env, args);
  if (mode !== 'apply') {
    log(mode === 'unconfigured'
      ? 'FrancoRoute : DATABASE_URL a renseigner dans Netlify (production, Builds et Functions), puis redeployer. Reservations non activees.'
      : 'FrancoRoute : preparation de la base ignoree hors deploiement de production.');
    return mode;
  }
  const {Client} = await import('pg');
  const client = new Client(connectionOptions(env));
  try {
    await client.connect();
    await runMigrations(client, await migrations(), log);
  } finally { await client.end().catch(() => {}); }
  return 'apply';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await prepareDatabase(); }
  catch (error) {
    console.error("DEBUG INFO:", error?.code, "|", error?.message);
    console.error(error?.message === 'MIGRATION_CHANGED'
      ? "FrancoRoute : une migration deja appliquee a ete modifiee. Restaurer le fichier d'origine et ajouter une nouvelle migration."
      : 'FrancoRoute : preparation de la base impossible. Verifier DATABASE_URL, DATABASE_CA_CERT et les droits du compte dans Netlify. Publication interrompue.');
    process.exitCode = 1;
  }
}
