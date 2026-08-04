// Emits dist/sw.js from public/sw.template.js — SPEC-V3.0.md section 5.
//
// The single job here is to make the worker's BYTES change on every deploy.
// A service worker update is only detected when the script differs from the
// installed copy, so a hardcoded CACHE_VERSION meant no update was ever
// detected, `activate` never ran, and stale caches were never purged.
//
// Deliberately a plain script rather than vite-plugin-pwa/Workbox: the worker
// is 70 readable lines with one unusual rule (cross-origin passthrough keeps
// Supabase uncached) that is easy to lose inside a generated bundle.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const templatePath = join(root, 'public', 'sw.template.js');
const outPath = join(root, 'dist', 'sw.js');

if (!existsSync(join(root, 'dist'))) {
  console.error('build-sw: dist/ does not exist — run this after `vite build`.');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const template = readFileSync(templatePath, 'utf8');

// Hash the built assets rather than using a timestamp, so an identical rebuild
// produces an identical worker. A timestamp would make every rebuild look like
// a new version and force a pointless cache purge on every device.
const indexHtml = readFileSync(join(root, 'dist', 'index.html'), 'utf8');
const buildHash = createHash('sha256').update(indexHtml).digest('hex').slice(0, 12);
const cacheVersion = `block12-${pkg.version}-${buildHash}`;

if (!template.includes('__CACHE_VERSION__')) {
  console.error('build-sw: sw.template.js has no __CACHE_VERSION__ placeholder. Refusing to emit a worker that can never update.');
  process.exit(1);
}

writeFileSync(outPath, template.replace(/__CACHE_VERSION__/g, cacheVersion), 'utf8');

// Vite copies public/ verbatim, so the unsubstituted template lands in dist as
// well. Remove it — a worker whose CACHE_VERSION is the literal
// '__CACHE_VERSION__' must never be reachable.
rmSync(join(root, 'dist', 'sw.template.js'), { force: true });

console.log(`build-sw: dist/sw.js written with cache version ${cacheVersion}`);
