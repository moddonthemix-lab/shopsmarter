// Finishes a web export in dist/ for static hosts (GitHub Pages, Railway, etc.):
//  - fills in %BASE_URL% in index.html (set EXPO_BASE_URL=/repo-name for GitHub Pages)
//  - copies index.html to 404.html so deep links like /list/123 load the app
//  - adds .nojekyll so GitHub Pages serves the _expo/ folder
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
const index = 'dist/index.html';
writeFileSync(index, readFileSync(index, 'utf8').replaceAll('%BASE_URL%', base));
copyFileSync(index, 'dist/404.html');
writeFileSync('dist/.nojekyll', '');
console.log(`Web build ready in dist/ (base URL: "${base || '/'}")`);
