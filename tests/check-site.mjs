/* Verifica a estrutura do site: arquivos referenciados existem, JS sem erro de sintaxe, manifest e cache do service worker */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ROOT, makeReporter } from './lib.mjs';

const r = makeReporter('Estrutura do site');
const html = readFileSync(ROOT + 'index.html', 'utf8');

const refs = [...html.matchAll(/(?:src|href)="([^"#:]+?)(?:\?[^"]*)?"/g)].map(m => m[1]).filter(u => !u.startsWith('//'));
const missing = refs.filter(u => !existsSync(ROOT + u));
r.check(missing.length === 0, 'Arquivos referenciados no index.html existem', missing.length ? missing.join(', ') : `${refs.length} referências`);

for (const f of ['js/app.js', 'sw.js']) {
  try { execFileSync(process.execPath, ['--check', ROOT + f], { stdio: 'pipe' }); r.ok(`Sintaxe JavaScript: ${f}`); }
  catch (e) { r.fail(`Sintaxe JavaScript: ${f}`, String(e.stderr).split('\n').slice(0, 4).join(' ')); }
}

try {
  const m = JSON.parse(readFileSync(ROOT + 'manifest.webmanifest', 'utf8'));
  const icons = (m.icons || []).map(i => i.src).filter(s => !existsSync(ROOT + s));
  r.check(m.name && m.start_url && icons.length === 0, 'Manifest PWA válido', icons.length ? 'ícones ausentes: ' + icons.join(', ') : m.name);
} catch (e) { r.fail('Manifest PWA válido', e.message); }

/* o cache do service worker precisa listar exatamente as versões usadas no HTML, senão o app offline fica desatualizado */
const sw = readFileSync(ROOT + 'sw.js', 'utf8');
const versioned = [...html.matchAll(/(?:src|href)="((?:css|js)\/[^"]+\?v=\d+)"/g)].map(m => m[1]);
const notCached = versioned.filter(v => !sw.includes(`'${v}'`));
r.check(notCached.length === 0, 'Versões de CSS/JS iguais no HTML e no service worker', notCached.length ? 'fora do cache: ' + notCached.join(', ') : versioned.join(', '));
const shell = [...sw.matchAll(/'([^']+)'/g)].map(m => m[1]).filter(s => /\.(png|js|css|webmanifest|html)/.test(s)).map(s => s.split('?')[0]).filter(s => !existsSync(ROOT + s));
r.check(shell.length === 0, 'Arquivos do cache offline existem', shell.length ? shell.join(', ') : 'ok');

r.check(/<meta name="viewport"/.test(html), 'Meta viewport (responsivo)');
r.finish();
