/* Valida o data.json: estrutura, datas, categorias, turnos, horários e IDs únicos */
import { readFileSync } from 'node:fs';
import { ROOT, makeReporter, summary } from './lib.mjs';

const r = makeReporter('Validação do data.json');
const CATS = ['inaugural','gestao','requisitos','arquitetura','interoperabilidade','metodologia','eletiva','acompanhamento','avaliacao','orientacao','marco','outro'];
const SLOTS = ['qua','sex1','sex2','sab1','sab2'];
const MODS = ['presencial','online','hibrido','adefinir'];
const STATUS = ['auto','concluido','cancelado'];
const ISO = /^\d{4}-\d{2}-\d{2}$/, TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const validDate = s => ISO.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

let data;
try { data = JSON.parse(readFileSync(ROOT + 'data.json', 'utf8')); r.ok('JSON válido'); }
catch (e) { r.fail('JSON válido', e.message); r.finish(); }

r.check(data.meta && typeof data.meta === 'object', 'Bloco meta presente');
r.check(!data.meta?.updatedAt || !isNaN(Date.parse(data.meta.updatedAt)), 'meta.updatedAt é uma data', data.meta?.updatedAt || '—');
r.check(Array.isArray(data.items) && data.items.length > 0, 'Lista de itens não vazia', `${data.items?.length ?? 0} itens`);

const items = data.items || [], ids = new Set(), problems = [];
for (const [n, it] of items.entries()) {
  const tag = `#${n + 1} ${it.id || '(sem id)'} “${it.titulo || ''}”`;
  if (!it.id) problems.push(`${tag}: sem id`);
  else if (ids.has(it.id)) problems.push(`${tag}: id duplicado`); else ids.add(it.id);
  if (!String(it.titulo || '').trim()) problems.push(`${tag}: título vazio`);
  if (!validDate(it.inicio)) problems.push(`${tag}: início inválido (${it.inicio})`);
  if (it.fim && !validDate(it.fim)) problems.push(`${tag}: fim inválido (${it.fim})`);
  if (validDate(it.inicio) && it.fim && it.fim < it.inicio) problems.push(`${tag}: fim antes do início`);
  if (!CATS.includes(it.categoria)) problems.push(`${tag}: categoria desconhecida (${it.categoria})`);
  if (it.modalidade && !MODS.includes(it.modalidade)) problems.push(`${tag}: modalidade desconhecida (${it.modalidade})`);
  if (it.status && !STATUS.includes(it.status)) problems.push(`${tag}: status desconhecido (${it.status})`);
  if (!Array.isArray(it.horarios || [])) problems.push(`${tag}: horarios não é lista`);
  for (const s of it.horarios || []) if (!SLOTS.includes(s)) problems.push(`${tag}: turno desconhecido (${s})`);
  if (it.horaIni && !TIME.test(it.horaIni)) problems.push(`${tag}: horaIni inválida (${it.horaIni})`);
  if (it.horaFim && (!TIME.test(it.horaFim) || !it.horaIni || it.horaFim <= it.horaIni)) problems.push(`${tag}: horaFim inválida (${it.horaFim})`);
}
r.check(problems.length === 0, 'Todos os itens consistentes', problems.length ? problems.slice(0, 10).join('; ') : `${items.length} itens verificados`);
problems.forEach(p => console.error('    · ' + p));

const byCat = items.reduce((a, i) => (a[i.categoria] = (a[i.categoria] || 0) + 1, a), {});
const dates = items.map(i => i.inicio).filter(validDate).sort();
summary(`<details><summary>📊 Conteúdo do calendário</summary>\n\n| Tipo | Itens |\n| --- | --- |\n${Object.entries(byCat).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}\n\nPeríodo: **${dates[0]}** a **${dates.at(-1)}**\n</details>\n`);
r.finish();
