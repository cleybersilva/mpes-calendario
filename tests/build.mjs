/* Monta a pasta _site só com os arquivos publicados (sem testes, docs ou README) e grava version.json */
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { ROOT, summary } from './lib.mjs';
import '../js/ics.js';

const OUT = ROOT + '_site/';
const FILES = ['index.html', 'data.json', 'manifest.webmanifest', 'sw.js', '.nojekyll', 'css', 'js', 'assets'];
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT);
for (const f of FILES) cpSync(ROOT + f, OUT + f, { recursive: true });

const sha = process.env.GITHUB_SHA || 'local';
const info = { commit: sha, shortCommit: sha.slice(0, 7), builtAt: new Date().toISOString(), run: process.env.GITHUB_RUN_NUMBER || null, dataUpdatedAt: JSON.parse(readFileSync(ROOT + 'data.json', 'utf8')).meta?.updatedAt || null };
writeFileSync(OUT + 'version.json', JSON.stringify(info, null, 2) + '\n');

/* feed de assinatura: Google Agenda, Outlook e Apple leem este arquivo e se atualizam sozinhos */
const data = JSON.parse(readFileSync(ROOT + 'data.json', 'utf8'));
const SITE = process.env.SITE_URL || 'https://cleybersilva.github.io/mpes-calendario/';
const ics = globalThis.MPESICS.build(data.items, { equipes: data.equipes || [], siteUrl: SITE });
const events = (ics.match(/BEGIN:VEVENT/g) || []).length;
if (!ics.startsWith('BEGIN:VCALENDAR') || events < data.items.filter(i => i.status !== 'cancelado').length) { console.error('Feed .ics inválido'); process.exit(1); }
writeFileSync(OUT + 'calendario.ics', ics);
console.log(`calendario.ics: ${events} eventos`);

const walk = d => readdirSync(d).flatMap(n => statSync(d + n).isDirectory() ? walk(d + n + '/') : [d + n]);
const files = walk(OUT), bytes = files.reduce((s, f) => s + statSync(f).size, 0);
console.log(`_site: ${files.length} arquivos, ${(bytes / 1024).toFixed(0)} KB`);
summary(`### 📦 Pacote de publicação\n\n| Item | Valor |\n| --- | --- |\n| Arquivos | ${files.length} |\n| Tamanho | ${(bytes / 1024).toFixed(0)} KB |\n| Commit | \`${info.shortCommit}\` |\n| Dados atualizados em | ${info.dataUpdatedAt} |\n| Feed da agenda | \`calendario.ics\` · ${events} eventos |\n`);
