/**
 * Repair for a GitHub upload that flattened the FrancoRoute directories.
 * No network calls, credentials, deletion or package installation.
 * Restores missing files from the supplied, hashed source snapshot.
 * Existing organized source files are preserved for later manual edits.
 */
import {readFile, writeFile, mkdir, lstat} from 'node:fs/promises';
import {resolve, dirname, relative, sep} from 'node:path';
import {createHash} from 'node:crypto';

const root = process.cwd();
const source = JSON.parse(await readFile(resolve(root, 'francoroute-dossiers.json'), 'utf8'));
if (source.format !== 'francoroute-repair-v1' || !Array.isArray(source.files)) throw new Error('Fichier de réparation FrancoRoute invalide.');
const folders = new Set(['app', 'components', 'db', 'lib', 'private', 'public', 'scripts', 'supabase', 'vendor']);
const rootFiles = new Set(['tsconfig.json', 'next.config.ts', 'postcss.config.mjs', 'proxy.ts']);
const pending = [];
for (const entry of source.files) {
  if (typeof entry.path !== 'string' || entry.path.includes('\\') || entry.path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Chemin de réparation invalide.');
  if (!folders.has(entry.path.split('/')[0]) && !rootFiles.has(entry.path)) throw new Error('Fichier de réparation inattendu.');
  const target = resolve(root, entry.path);
  if (relative(root, target).startsWith('..' + sep)) throw new Error('Chemin de réparation hors projet.');
  const data = Buffer.from(entry.base64, 'base64');
  if (createHash('sha256').update(data).digest('hex') !== entry.sha256) throw new Error('Archive FrancoRoute incomplète : ' + entry.path);
  for (let at = target; at !== root; at = dirname(at)) {
    const info = await lstat(at).catch(e => {if (e.code === 'ENOENT') return null; throw e;});
    if (info?.isSymbolicLink()) throw new Error('Lien symbolique inattendu : ' + entry.path);
  }
  pending.push({target, data});
}
let restored = 0;
for (const {target, data} of pending) {
  if (await lstat(target).catch(e => {if (e.code === 'ENOENT') return null; throw e;})) continue;
  await mkdir(dirname(target), {recursive: true});
  await writeFile(target, data, {flag: 'wx'});
  restored++;
}

// Ignore the misplaced .tsx/.ts files left at the root by the earlier upload.
// Keep the user's other TypeScript settings; do not disable type checking.
const configPath = resolve(root, 'tsconfig.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
config.include = [
  'next-env.d.ts', 'next.config.ts', 'proxy.ts',
  'app/**/*.ts', 'app/**/*.tsx', 'components/**/*.ts', 'components/**/*.tsx',
  'lib/**/*.ts', 'lib/**/*.tsx', 'db/**/*.ts',
  '.next/types/**/*.ts', '.next/dev/types/**/*.ts',
];
await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
await readFile(resolve(root, 'app/page.tsx'));
await readFile(resolve(root, 'app/layout.tsx'));
console.log(`FrancoRoute : ${restored} fichiers restaurés dans leurs dossiers ; pages prêtes pour la compilation.`);
