/* Testes de fumaça no navegador (Chromium): desktop e celular.
   Uso: node tests/smoke.mjs [desktop|mobile|all] [URL opcional — padrão: servidor local] */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { ROOT, makeReporter, summary } from './lib.mjs';
import { serve } from './serve.mjs';

const which = process.argv[2] || 'all';
const target = process.argv[3];
const data = JSON.parse(readFileSync(ROOT + 'data.json', 'utf8'));
const SHOTS = ROOT + 'test-results/';
mkdirSync(SHOTS, { recursive: true });

const server = target ? null : await serve(ROOT);
const URL0 = target || server.url;
const browser = await chromium.launch();
const errors = [];
const watch = pg => {
  pg.on('pageerror', e => errors.push(String(e)));
  pg.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  pg.on('dialog', d => d.accept());
};

async function desktop() {
  const r = makeReporter(`Testes no navegador — desktop (1366px)${target ? ' · produção' : ''}`);
  const pg = await browser.newPage({ viewport: { width: 1366, height: 900 } }); watch(pg);
  await pg.goto(URL0 + '?ci=' + Date.now()); await pg.waitForSelector('body:not(.loading)', { timeout: 15000 });
  const n = await pg.locator('#view .item').count();
  r.check(n === data.items.length, 'Linha do tempo mostra todos os itens', `${n} de ${data.items.length}`);
  r.check((await pg.locator('#nextCard h2').innerText()).length > 0, 'Cartão "Próximo encontro" preenchido', await pg.locator('#nextCard h2').innerText());
  for (const v of ['calendar', 'table', 'equipes', 'timeline']) {
    await pg.click(`.tabs [data-view=${v}]`);
    const ok = v === 'equipes' ? await pg.locator('#view .team').count() === (data.equipes || []).length && await pg.locator('#view .members li:not(.none)').count() === (data.equipes || []).reduce((s, t) => s + t.membros.length, 0) : v === 'calendar' ? await pg.locator('#calGrid .day').count() >= 28 : v === 'table' ? await pg.locator('#view tbody tr').count() === data.items.length : await pg.locator('#view .item').count() === data.items.length;
    r.check(ok, `Visualização "${v}" renderiza`);
  }
  if (!target) {
    await pg.click('#btnNew'); await pg.click('#formEdit button[type=submit]');
    r.check(await pg.locator('#fTitulo.invalid').count() === 1, 'Formulário bloqueia item sem título');
    await pg.fill('#eTitulo', 'Item de teste CI'); await pg.fill('#eIni', '2026-12-01'); await pg.click('#formEdit button[type=submit]');
    r.check(await pg.locator('.item:has-text("Item de teste CI")').count() === 1, 'Criar item');
    await pg.locator('.item:has-text("Item de teste CI") [data-a=edit]').click(); await pg.fill('#eTitulo', 'Item de teste CI editado'); await pg.click('#formEdit button[type=submit]');
    r.check(await pg.locator('.item:has-text("Item de teste CI editado")').count() === 1, 'Editar item');
    await pg.locator('.item:has-text("Item de teste CI editado") [data-a=del]').click();
    r.check(await pg.locator('.item:has-text("Item de teste CI")').count() === 0, 'Excluir item');
    await pg.click('#toast button');
    r.check(await pg.locator('.item:has-text("Item de teste CI editado")').count() === 1, 'Desfazer exclusão');
    r.check(await pg.locator('#syncBadge.dirty').count() === 1, 'Selo indica alterações não publicadas');
    if ((data.equipes || []).length) {
      await pg.click('.tabs [data-view=equipes]');
      await pg.locator('#view [data-team-work]').first().click();
      r.check(!(await pg.locator('#fEquipe').isHidden()) && await pg.inputValue('#eEquipe') === data.equipes[0].id, 'Agendar trabalho já vem com a equipe');
      await pg.fill('#eTitulo', 'Entrega CI'); await pg.fill('#eIni', '2026-12-02'); await pg.click('#formEdit button[type=submit]');
      await pg.click('.tabs [data-view=equipes]');
      r.check((await pg.locator('#view .team').first().innerText()).includes('Entrega CI'), 'Trabalho aparece no cartão da equipe');
      await pg.click('.tabs [data-view=timeline]');
    }
    const [dl] = await Promise.all([pg.waitForEvent('download'), (async () => { await pg.click('#btnMenu'); await pg.click('[data-act=ics]'); })()]);
    const ics = readFileSync(await dl.path(), 'utf8');
    r.check(ics.startsWith('BEGIN:VCALENDAR') && (ics.match(/BEGIN:VEVENT/g) || []).length > data.items.length, 'Exportação .ics', `${(ics.match(/BEGIN:VEVENT/g) || []).length} eventos`);
  }
  await pg.screenshot({ path: SHOTS + 'desktop.png', fullPage: false });
  r.check(errors.length === 0, 'Sem erros no console', errors.slice(0, 3).join(' | '));
  return r;
}

async function mobile() {
  const r = makeReporter(`Testes no navegador — celular (390px)${target ? ' · produção' : ''}`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const pg = await ctx.newPage(); watch(pg);
  await pg.goto(URL0 + '?ci=' + Date.now()); await pg.waitForSelector('body:not(.loading)', { timeout: 15000 });
  r.check(await pg.locator('.bnav').isVisible(), 'Barra de navegação inferior visível');
  r.check(!(await pg.locator('.tabs').isVisible()), 'Abas de desktop ocultas no celular');
  const sw = await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  r.check(sw, 'Sem rolagem horizontal');
  await pg.locator('#view .item').nth(1).tap();
  r.check(await pg.locator('#dlgView[open]').count() === 1, 'Tocar no item abre o detalhe');
  await pg.goBack();
  r.check(await pg.locator('dialog[open]').count() === 0, 'Botão voltar fecha o detalhe');
  await pg.tap('.bnav [data-view=equipes]');
  r.check(await pg.locator('#view .team').count() === (data.equipes || []).length, 'Aba Equipes no celular', `${await pg.locator('#view .team').count()} equipes`);
  await pg.tap('.bnav [data-view=timeline]');
  await pg.tap('#btnFilters');
  r.check(await pg.locator('#filterPanel.open').count() === 1, 'Painel de filtros abre');
  await pg.tap('#filterPanel .fp-foot [data-fp-close]');
  await pg.tap('.bnav [data-view=calendar]');
  r.check(await pg.locator('.agenda').isVisible(), 'Calendário com agenda do dia');
  await pg.screenshot({ path: SHOTS + 'mobile.png' });
  r.check(errors.length === 0, 'Sem erros no console', errors.slice(0, 3).join(' | '));
  return r;
}

let code = 0;
try {
  const reps = [];
  if (which === 'all' || which === 'desktop') reps.push(await desktop());
  if (which === 'all' || which === 'mobile') reps.push(await mobile());
  for (const r of reps) if (r.finish(false)) code = 1;
} catch (e) {
  console.error(e); summary(`### ❌ Erro inesperado nos testes\n\n\`\`\`\n${String(e.stack || e).slice(0, 1500)}\n\`\`\``); code = 1;
} finally { await browser.close(); server?.close(); }
process.exit(code);
