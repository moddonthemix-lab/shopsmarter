// Finishes a web export in dist/ for static hosts (GitHub Pages, Railway, etc.):
//  - fills in %BASE_URL% in index.html (set EXPO_BASE_URL=/repo-name for GitHub Pages)
//  - adds a service worker so the installed app works offline
//  - copies index.html to 404.html so deep links like /list/123 load the app
//  - adds .nojekyll so GitHub Pages serves the _expo/ folder
import { createHash } from 'node:crypto';
import { copyFileSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = 'dist';
const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

// Precache the app shell and every bundled asset.
const assets = files(dist)
  .map((f) => relative(dist, f).split('\\').join('/'))
  .filter((f) => !/(^|\/)\.|\.map$|^404\.html$|^metadata\.json$|^sw\.js$/.test(f));
const buildId = createHash('sha256')
  .update(assets.map((f) => f + statSync(join(dist, f)).size).join('\n'))
  .digest('hex')
  .slice(0, 12);

const sw = readFileSync('scripts/templates/sw.js', 'utf8')
  .replace('__BUILD_ID__', buildId)
  .replace('__BASE_URL__', base)
  .replace('__PRECACHE__', JSON.stringify(assets.map((f) => `${base}/${f}`)));
writeFileSync(join(dist, 'sw.js'), sw);

const register = `<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('${base}/sw.js', { scope: '${base}/' });
    });
  }
</script>`;
const index = join(dist, 'index.html');
const html = readFileSync(index, 'utf8').replaceAll('%BASE_URL%', base).replace('</head>', `${register}\n</head>`);
writeFileSync(index, html);
copyFileSync(index, join(dist, '404.html'));
writeFileSync(join(dist, '.nojekyll'), '');
console.log(`Web build ready in dist/ (base URL: "${base || '/'}", ${assets.length} files precached, build ${buildId})`);
