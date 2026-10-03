import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {preparationMode, connectionOptions, migrations, runMigrations} from './prepare-database.mjs';

const db = new PGlite();
// PGlite is single-connection; the production advisory lock is not available here.
const client = {query: (sql, values) => sql.includes('pg_advisory_xact_lock')
  ? Promise.resolve({rows: []}) : values ? db.query(sql, values) : db.exec(sql).then(r => r.at(-1))};
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  const entries = await migrations();
  await runMigrations(client, entries, () => {});
  await db.query('INSERT INTO slots(id,starts) VALUES($1,$2)', ['existing-slot', 1800000000]);
  await db.query('INSERT INTO practice_credits(id,client_email,minutes,payment_reference,created_by,created,eligible) VALUES($1,$2,60,$3,$4,1,true)', ['existing-credit', 'client@example.com', 'PAID-001', 'owner']);
  await runMigrations(client, entries, () => {});
  assert.equal((await db.query('SELECT count(*)::int AS n FROM francoroute_migrations')).rows[0].n, 2);
  assert.equal((await db.query('SELECT minutes FROM practice_credits')).rows[0].minutes, 60);
  assert.equal((await db.query('SELECT id FROM slots')).rows[0].id, 'existing-slot');
  await assert.rejects(runMigrations(client, [{...entries[0], checksum: 'changed'}], () => {}), /MIGRATION_CHANGED/);
  await assert.rejects(runMigrations(client, [{name: 'failure.sql', checksum: 'x', sql: "INSERT INTO slots(id,starts) VALUES('rollback',1800000100); SELECT missing_column FROM slots;"}], () => {}));
  assert.equal((await db.query("SELECT count(*)::int AS n FROM slots WHERE id='rollback'")).rows[0].n, 0);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM francoroute_migrations WHERE name='failure.sql'")).rows[0].n, 0);
  await db.exec('SET ROLE anon');
  await assert.rejects(db.query('SELECT * FROM francoroute_migrations'), /permission denied/);
  await db.exec('RESET ROLE');

  assert.equal(preparationMode({NETLIFY: 'true', CONTEXT: 'deploy-preview', DATABASE_URL: 'present'}, ['--apply']), 'preview');
  assert.equal(preparationMode({NETLIFY: 'true', CONTEXT: 'branch-deploy', DATABASE_URL: 'present'}), 'preview');
  assert.equal(preparationMode({NETLIFY: 'true', CONTEXT: 'production'}), 'unconfigured');
  assert.equal(preparationMode({DATABASE_URL: 'present'}), 'local');
  assert.equal(preparationMode({DATABASE_URL: 'present'}, ['--apply']), 'apply');
  assert.equal(preparationMode({NETLIFY: 'true', CONTEXT: 'production', DATABASE_URL: 'present'}), 'apply');
  const options = connectionOptions({DATABASE_URL: 'postgresql://example.invalid/database?sslmode=no-verify', DATABASE_CA_CERT: 'A\\nB'});
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.ssl.ca, 'A\nB');
  assert.equal(new URL(options.connectionString).searchParams.has('sslmode'), false);
  console.log('Préparation de la base : répétition, conservation, rollback, confidentialité et exclusion des aperçus vérifiés.');
} finally { await db.close(); }
