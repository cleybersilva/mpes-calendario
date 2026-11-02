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
    {
      const it = data.items.find(i => i.horaIni && i.horaFim && i.status !== 'cancelado') || data.items.find(i => (i.horarios || []).length);
      await pg.locator(`#view [data-id="${it.id}"] [data-a=cal]`).click();
      const g = await pg.locator('#acBody a[data-cal-kind=google]').first().getAttribute('href');
      const o = await pg.locator('#acBody a[data-cal-kind=outlook]').first().getAttribute('href');
      r.check(g.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE') && g.includes('dates=' + it.inicio.replace(/-/g, '')), 'Adicionar à agenda: link do Google', it.titulo);
      r.check(o.includes('outlook.live.com') && o.includes('startdt=' + encodeURIComponent(it.inicio)), 'Adicionar à agenda: link do Outlook');
      r.check(await pg.locator('#acBody a[data-cal-kind=yahoo]').count() > 0 && await pg.locator('#acIcs').count() === 1, 'Adicionar à agenda: Yahoo e .ics');
      await pg.keyboard.press('Escape');
      await pg.click('#btnAddCal');
      r.check(await pg.locator('#dlgSub[open] #subIcs').count() === 1, 'Botão "Adicionar à minha agenda" abre as opções');
      await pg.keyboard.press('Escape');
    }
    const [dl] = await Promise.all([pg.waitForEvent('download'), (async () => { await pg.click('#btnAddCal'); await pg.click('#subIcs'); })()]);
    const ics = readFileSync(await dl.path(), 'utf8');
    r.check(ics.startsWith('BEGIN:VCALENDAR') && (ics.match(/BEGIN:VEVENT/g) || []).length > data.items.length, 'Exportação .ics', `${(ics.match(/BEGIN:VEVENT/g) || []).length} eventos`);
  }
  if (target) {
    const res = await pg.request.get(new URL('calendario.ics', URL0).href);
    const body = res.ok() ? await res.text() : '';
    r.check(body.startsWith('BEGIN:VCALENDAR'), 'Feed de assinatura calendario.ics no ar', `${(body.match(/BEGIN:VEVENT/g) || []).length} eventos`);
    await pg.click('#btnAddCal');
    const gs = await pg.locator('#subBody a[data-cal-kind=google]').getAttribute('href');
    r.check(gs.includes(encodeURIComponent('webcal://')), 'Link de assinatura do Google Agenda');
    await pg.keyboard.press('Escape');
  }
  {
    /* animações ligadas (?anim): a abertura some sozinha e a troca de aba continua funcionando */
    const ap = await browser.newPage({ viewport: { width: 1366, height: 900 } }); watch(ap);
    await ap.goto(URL0 + '?anim=1&ci=' + Date.now());
    r.check(await ap.locator('#splash').count() === 1, 'Abertura animada aparece');
    await ap.waitForSelector('#splash', { state: 'detached', timeout: 8000 }).catch(() => {});
    r.check(await ap.locator('#splash').count() === 0 && !(await ap.evaluate(() => document.body.classList.contains('pre'))), 'Abertura termina e libera o app');
    await ap.click('.tabs [data-view=table]'); await ap.waitForTimeout(700);
    const ind = await ap.evaluate(() => { const i = document.querySelector('.tab-ind'), b = document.querySelector('.tabs [aria-selected=true]'); return Math.abs(i.getBoundingClientRect().left - b.getBoundingClientRect().left) < 3; });
    r.check(ind && await ap.locator('#view tbody tr').count() === data.items.length, 'Troca de aba animada e indicador no lugar');
    /* a barra de abas não pode sair do lugar ao trocar de aba (nada "desce" ou "sobe"), inclusive
       com a barra colada no cabeçalho e em tela alta. Clique real por coordenada (o click() do
       Playwright rola o elemento sozinho e mascararia o resultado). */
    let maxShift = 0;
    await ap.setViewportSize({ width: 1920, height: 1080 });
    for (const pos of ['0', "document.querySelector('.toolbar').getBoundingClientRect().top + scrollY - 70"]) {
      for (const v of ['calendar', 'table', 'equipes', 'timeline', 'equipes', 'calendar']) {
        await ap.evaluate(`window.scrollTo(0, ${pos})`); await ap.waitForTimeout(80);
        const y0 = await ap.evaluate(() => document.querySelector('.toolbar').getBoundingClientRect().top);
        const bx = await ap.locator(`.tabs [data-view=${v}]`).boundingBox();
        await ap.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); await ap.waitForTimeout(450);
        const y1 = await ap.evaluate(() => document.querySelector('.toolbar').getBoundingClientRect().top);
        maxShift = Math.max(maxShift, Math.abs(y1 - y0));
      }
    }
    r.check(maxShift < 2, 'Abas não deslocam o conteúdo', `${Math.round(maxShift)}px`);
    await ap.close();
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
  {
    await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await pg.waitForTimeout(150);
    const y0 = await pg.evaluate(() => document.querySelector('.toolbar').getBoundingClientRect().top);
    const bx = await pg.locator('.bnav [data-view=calendar]').boundingBox();
    await pg.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2); await pg.waitForTimeout(400);
    const y1 = await pg.evaluate(() => document.querySelector('.toolbar').getBoundingClientRect().top);
    r.check(Math.abs(y1 - y0) < 2, 'Barra de busca fica no lugar ao trocar de aba (lista rolada)', `${Math.round(y0)} → ${Math.round(y1)}px`);
    await pg.tap('.bnav [data-view=timeline]');
  }
  await pg.tap('.bnav [data-view=equipes]');
  r.check(await pg.locator('#view .team').count() === (data.equipes || []).length, 'Aba Equipes no celular', `${await pg.locator('#view .team').count()} equipes`);
  await pg.tap('.bnav [data-view=timeline]');
  await pg.tap('#btnFilters');
  r.check(await pg.locator('#filterPanel.open').count() === 1, 'Painel de filtros abre');
  await pg.tap('#filterPanel .fp-foot [data-fp-close]');
  await pg.tap('.bnav [data-view=calendar]');
  r.check(await pg.locator('.agenda').isVisible(), 'Calendário com agenda do dia');
  {
    /* com animações ligadas (como no celular de verdade): a troca de aba não pode alargar a página
       (o navegador reduziria o zoom e tudo "subiria e desceria") nem mexer a barra inferior */
    const actx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const ap = await actx.newPage(); watch(ap);
    await ap.goto(URL0 + '?anim=1&ci=' + Date.now());
    await ap.waitForSelector('#splash', { state: 'detached', timeout: 8000 }).catch(() => {});
    await ap.waitForTimeout(900);
    let over = 0, bnMove = 0;
    for (const v of ['calendar', 'table', 'equipes', 'timeline']) {
      await ap.evaluate(() => { window.__w = []; const f = () => { window.__w.push([document.documentElement.scrollWidth - innerWidth, document.querySelector('.bnav').getBoundingClientRect().top]); if (window.__w.length < 40) requestAnimationFrame(f); }; f(); });
      const bx = await ap.locator(`.bnav [data-view=${v}]`).boundingBox();
      await ap.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2); await ap.waitForTimeout(750);
      const w = await ap.evaluate(() => window.__w);
      over = Math.max(over, ...w.map(x => x[0]));
      bnMove = Math.max(bnMove, Math.max(...w.map(x => x[1])) - Math.min(...w.map(x => x[1])));
    }
    r.check(over <= 0 && bnMove <= 1, 'Troca de aba animada não alarga a página nem mexe a barra inferior', `transbordo ${over}px · barra ${Math.round(bnMove)}px`);
    await actx.close();
  }
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
