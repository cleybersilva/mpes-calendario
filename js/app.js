/* =========================================================
   MPES 2026.2 · Calendário vivo — lógica da aplicação
   Sem dependências. Dados: data.json (publicado) + localStorage (local).
   ========================================================= */
(() => {
'use strict';

/* ---------- constantes ---------- */
const KEYS = { data:'mpes2026_data_v1', gh:'mpes2026_gh_v1', theme:'mpes2026_theme', view:'mpes2026_view', past:'mpes2026_showpast' };
const SCHEMA = 1;
const CATS = {
  inaugural:{label:'Aula inaugural'}, gestao:{label:'Gestão'}, requisitos:{label:'Requisitos'},
  arquitetura:{label:'Arquitetura'}, interoperabilidade:{label:'Interoperabilidade'}, metodologia:{label:'Metodologia'},
  eletiva:{label:'Eletivas'}, acompanhamento:{label:'Acompanhamento dos projetos'}, avaliacao:{label:'Avaliação de projetos'},
  marco:{label:'Marco da dissertação'}, outro:{label:'Outro'}
};
const SLOTS = {
  qua:{label:'Qua 19h–21h', dow:3, s:'19:00', e:'21:00'},
  sex1:{label:'Sex 14h–17h', dow:5, s:'14:00', e:'17:00'},
  sex2:{label:'Sex 18h–21h', dow:5, s:'18:00', e:'21:00'},
  sab1:{label:'Sáb 08h–12h', dow:6, s:'08:00', e:'12:00'},
  sab2:{label:'Sáb 13h–18h', dow:6, s:'13:00', e:'18:00'}
};
const MODS = { presencial:'Presencial', online:'Online', hibrido:'Híbrido' };
const STATUS = ['auto','concluido','cancelado'];
const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const DOW = ['dom','seg','ter','qua','qui','sex','sáb'];
const DAY = 864e5;

/* ---------- utilitários ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => String(n).padStart(2,'0');
const pd = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today0 = () => { const t = new Date(); t.setHours(0,0,0,0); return t; };
const color = c => `var(--c-${CATS[c] ? c : 'outro'})`;
const uid = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const clone = o => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const isMobile = () => matchMedia('(max-width:720px)').matches;
const haptic = () => { try { navigator.vibrate && navigator.vibrate(8); } catch(_){} };
const debounce = (fn, ms) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; };
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = s => typeof s === 'string' && ISO_RE.test(s) && iso(pd(s)) === s;
const safeUrl = s => /^https?:\/\/[^\s]+$/i.test(s || '');

/* localStorage protegido: navegação privada, cota cheia ou bloqueio não quebram a página */
const store = {
  get(k, fallback=null){ try { const v = localStorage.getItem(k); return v === null ? fallback : v; } catch(_){ return fallback; } },
  getJSON(k){ try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch(_){ return null; } },
  set(k, v){ try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch(_){ return false; } },
  del(k){ try { localStorage.removeItem(k); } catch(_){} }
};

/* ---------- validação / normalização ---------- */
function normItem(raw){
  if (!raw || typeof raw !== 'object') return null;
  const inicio = String(raw.inicio || '');
  if (!validDate(inicio)) return null;
  let fim = String(raw.fim || inicio);
  if (!validDate(fim) || fim < inicio) fim = inicio;
  return {
    id: str(raw.id, 40) || uid(),
    titulo: str(raw.titulo, 140) || '(sem título)',
    modulo: str(raw.modulo, 120),
    categoria: CATS[raw.categoria] ? raw.categoria : 'outro',
    inicio, fim,
    horarios: Array.isArray(raw.horarios) ? [...new Set(raw.horarios.filter(k => SLOTS[k]))] : [],
    professor: str(raw.professor, 80),
    modalidade: MODS[raw.modalidade] ? raw.modalidade : 'presencial',
    semestre: [0,1,2].includes(Number(raw.semestre)) ? Number(raw.semestre) : 1,
    local: str(raw.local, 300),
    notas: str(raw.notas, 2000),
    status: STATUS.includes(raw.status) ? raw.status : 'auto'
  };
}
function normData(d){
  const items = [], seen = new Set(); let dropped = 0;
  (Array.isArray(d?.items) ? d.items : []).forEach(r => {
    const it = normItem(r); if (!it){ dropped++; return; }
    while (seen.has(it.id)) it.id = uid();
    seen.add(it.id); items.push(it);
  });
  const meta = (d && typeof d.meta === 'object' && d.meta) ? {...d.meta} : {};
  meta.schema = SCHEMA;
  return { data:{meta, items}, dropped };
}

/* ---------- estado ---------- */
let state = {meta:{}, items:[]};
let remote = null;             // última versão publicada conhecida
let view = store.get(KEYS.view, 'timeline');
if (!['timeline','calendar','table'].includes(view)) view = 'timeline';
let calCursor = null, selDay = null, editingId = null, viewingId = null;
let sortKey = 'inicio', sortDir = 1;

/* ---------- toast ---------- */
function toast(msg, opts={}){
  const t = $('#toast'); t.innerHTML = '';
  const span = document.createElement('span'); span.textContent = msg; t.appendChild(span);
  if (opts.action){ const b = document.createElement('button'); b.type='button'; b.textContent = opts.action; b.onclick = () => { hide(); opts.onAction(); }; t.appendChild(b); }
  t.style.pointerEvents = opts.action ? 'auto' : 'none';
  t.classList.add('show'); clearTimeout(t._h);
  function hide(){ t.classList.remove('show'); t.style.pointerEvents = 'none'; }
  t._h = setTimeout(hide, opts.ms || (opts.action ? 6000 : 2600));
}

/* ---------- persistência ---------- */
function stamp(){ state.meta.updatedAt = new Date().toISOString(); }
function saveLocal(){
  stamp();
  if (!store.set(KEYS.data, state)) toast('Não foi possível salvar no navegador (armazenamento cheio ou bloqueado)', {ms:5000});
  render();
}
const sameItems = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isDirty = () => !!remote && !sameItems(remote.items, state.items);

async function fetchRemote(){
  const r = await fetch('data.json?t=' + Date.now(), {cache:'no-store'});
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return normData(await r.json()).data;
}
async function load(){
  let local = store.getJSON(KEYS.data), rem = null;
  try { rem = await fetchRemote(); } catch(_){ /* offline: segue com a cópia local */ }
  remote = rem ? clone(rem) : null;
  if (local && Array.isArray(local.items)){
    const n = normData(local); local = n.data;
    if (n.dropped) toast(`${n.dropped} item(ns) inválido(s) ignorado(s)`);
  } else local = null;
  const t = d => new Date(d?.meta?.updatedAt || 0).getTime();
  if (local && (!rem || t(local) >= t(rem))) state = local;
  else if (rem){ state = clone(rem); store.del(KEYS.data); }
  else { state = {meta:{turma:'MPES 2026.2', schema:SCHEMA}, items:[]}; toast('Sem conexão e sem dados salvos neste navegador', {ms:5000}); }
  document.body.classList.remove('loading');
  render();
}

/* ---------- derivados ---------- */
function statusOf(it){
  if (it.status === 'cancelado') return 'cancelado';
  if (it.status === 'concluido') return 'concluido';
  const t = today0(), a = pd(it.inicio), b = pd(it.fim);
  if (b < t) return 'passado';
  if (a <= t) return 'hoje';
  return 'futuro';
}
const isDone = it => ['passado','concluido'].includes(statusOf(it));
const isUpcoming = it => ['futuro','hoje'].includes(statusOf(it));
const isClass = it => !['marco','acompanhamento','avaliacao'].includes(it.categoria);
const byDate = (a,b) => a.inicio.localeCompare(b.inicio) || a.fim.localeCompare(b.fim) || a.titulo.localeCompare(b.titulo, 'pt');
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function filters(){ return { q:norm($('#q').value.trim()), c:$('#fCat').value, s:$('#fSem').value, p:$('#fProf').value, past:$('#fPast').checked }; }
function filtered(opts={}){
  const f = filters();
  return state.items.filter(it => {
    if (f.c && it.categoria !== f.c) return false;
    if (f.s !== '' && String(it.semestre) !== f.s) return false;
    if (f.p && it.professor !== f.p) return false;
    if (!f.past && !opts.ignorePast && isDone(it)) return false;
    if (f.q){ const h = norm([it.titulo,it.modulo,it.professor,it.notas,it.local,CATS[it.categoria]?.label].join(' ')); if (!f.q.split(/\s+/).every(w => h.includes(w))) return false; }
    return true;
  }).sort(byDate);
}
function fmtRange(it, long=false){
  const a = pd(it.inicio), b = pd(it.fim);
  const f = d => long ? `${DOW[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}` : `${pad(d.getDate())}/${pad(d.getMonth()+1)}`;
  if (it.inicio === it.fim) return f(a);
  if (!long && a.getMonth()===b.getMonth() && a.getFullYear()===b.getFullYear()) return `${a.getDate()}–${b.getDate()}/${pad(b.getMonth()+1)}`;
  return `${f(a)} – ${f(b)}${long ? '' : '/' + String(b.getFullYear()).slice(2)}`;
}
const slotTxt = it => it.horarios.map(k => SLOTS[k]?.label).filter(Boolean).join(' · ');
function firstStart(it){
  const d = pd(it.inicio);
  const s = it.horarios.map(k => SLOTS[k]).filter(Boolean);
  for (let x = new Date(d); x <= pd(it.fim); x.setDate(x.getDate()+1)){
    const hit = s.filter(z => z.dow === x.getDay()).sort((a,b) => a.s.localeCompare(b.s))[0];
    if (hit){ const [h,m] = hit.s.split(':').map(Number); x.setHours(h,m,0,0); return x; }
  }
  return d;
}

/* ---------- ícones ---------- */
const ICON = {
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>',
  prev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>',
  next:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
};

/* ---------- render: topo ---------- */
function tagsFor(it){
  const st = statusOf(it); let t = `<span class="tag">${esc(CATS[it.categoria]?.label || 'Outro')}</span>`;
  if (it.modalidade !== 'presencial') t += `<span class="tag plain">${MODS[it.modalidade]}</span>`;
  if (st === 'hoje') t += '<span class="tag now">Hoje</span>';
  if (st === 'concluido' || st === 'passado') t += '<span class="tag ok">Realizado</span>';
  if (st === 'cancelado') t += '<span class="tag no">Cancelado</span>';
  return t;
}
function renderKpis(){
  const t = today0();
  const classes = state.items.filter(i => isClass(i) && i.status !== 'cancelado');
  const done = classes.filter(isDone).length;
  const pct = classes.length ? Math.round(done/classes.length*100) : 0;
  $('#kProg').textContent = pct + '%'; $('#kBar').style.width = pct + '%'; $('#kBarWrap').setAttribute('aria-valuenow', pct);
  $('#kProgS').textContent = `${done} de ${classes.length} encontros de aula`;
  const up = state.items.filter(i => i.status !== 'cancelado' && i.categoria !== 'marco' && isUpcoming(i));
  $('#kRest').textContent = up.length;
  $('#kRestS').textContent = `${up.filter(isClass).length} de aula · ${up.filter(i => !isClass(i)).length} de projetos`;
  const fridays = new Set();
  state.items.forEach(i => { if (i.status === 'cancelado' || !i.horarios.some(k => k.startsWith('sex'))) return;
    for (let d = pd(i.inicio); d <= pd(i.fim); d.setDate(d.getDate()+1)) if (d.getDay() === 5 && d >= t) fridays.add(iso(d)); });
  $('#kSex').textContent = fridays.size;
  const def = state.items.filter(i => /defesa da disserta/i.test(i.titulo)).sort(byDate)[0];
  if (def){ const d = pd(def.inicio); const m = Math.max(0, Math.round((d - t)/(DAY*30.44)));
    $('#kDef').textContent = `${pad(d.getMonth()+1)}/${d.getFullYear()}`; $('#kDefS').textContent = `prazo regular · ~${m} meses`; }
  else { $('#kDef').textContent = '—'; $('#kDefS').textContent = ''; }
}
function nextItem(){ return state.items.filter(i => i.status !== 'cancelado' && i.categoria !== 'marco' && isUpcoming(i)).sort(byDate)[0]; }
function renderNext(){
  const n = nextItem(), el = $('#nextCard');
  if (!n){ el.innerHTML = '<div class="lbl">Próximo encontro</div><h2>Nenhum encontro agendado</h2><div class="sub">Toque em + para adicionar.</div>'; el.dataset.id = ''; return; }
  const diff = Math.max(0, firstStart(n) - new Date());
  const dd = Math.floor(diff/DAY), hh = Math.floor(diff%DAY/36e5), mm = Math.floor(diff%36e5/6e4);
  el.dataset.id = n.id;
  el.innerHTML = `<div class="lbl">${statusOf(n) === 'hoje' ? 'Acontecendo hoje' : 'Próximo encontro'}</div>
    <h2>${esc(n.titulo)}</h2>
    <div class="sub">${esc(n.modulo || CATS[n.categoria]?.label || '')}${n.professor ? ' · ' + esc(n.professor) : ''}</div>
    <div class="meta"><span class="chip-w">${esc(fmtRange(n,true))}</span>${slotTxt(n) ? `<span class="chip-w">${esc(slotTxt(n))}</span>` : ''}${n.modalidade === 'online' ? '<span class="chip-w">Online</span>' : ''}</div>
    <div class="count" aria-label="Faltam ${dd} dias, ${hh} horas e ${mm} minutos"><div><b>${dd}</b><small>dias</small></div><div><b>${hh}</b><small>horas</small></div><div><b>${mm}</b><small>min</small></div></div>`;
}

/* ---------- render: linha do tempo ---------- */
function itemCard(it){
  const st = statusOf(it), a = pd(it.inicio), b = pd(it.fim), multi = it.inicio !== it.fim, long = (b - a) >= 7*DAY;
  const big = multi && !long ? `${a.getDate()}–${b.getDate()}` : a.getDate();
  const small = long ? `até ${pad(b.getDate())}/${pad(b.getMonth()+1)}/${String(b.getFullYear()).slice(2)}` : (multi ? `${DOW[a.getDay()]}–${DOW[b.getDay()]}` : DOW[a.getDay()]);
  return `<article class="card item ${isDone(it)?'past':''} ${st==='hoje'?'today':''} ${st==='cancelado'?'cancel':''}" style="--c:${color(it.categoria)}" data-id="${esc(it.id)}" tabindex="0" aria-label="${esc(it.titulo)}, ${esc(fmtRange(it,true))}">
    <div class="datebox"><b>${big}</b><small>${small}</small></div>
    <div class="it-main">
      <div class="it-top">${tagsFor(it)}</div>
      <div class="it-title">${esc(it.titulo)}</div>
      <div class="it-sub">
        ${it.modulo ? `<span>${esc(it.modulo)}</span>` : ''}
        ${it.professor ? `<span>${ICON.user}${esc(it.professor)}</span>` : ''}
        ${slotTxt(it) ? `<span>${ICON.clock}${esc(slotTxt(it))}</span>` : ''}
      </div>
      ${it.notas ? `<div class="it-notes">${esc(it.notas)}</div>` : ''}
    </div>
    <div class="it-act">
      <button type="button" data-a="done" class="${it.status==='concluido'?'on':''}" title="${it.status==='concluido'?'Desmarcar concluído':'Marcar como concluído'}" aria-label="Concluir">${ICON.check}</button>
      <button type="button" data-a="edit" title="Editar" aria-label="Editar">${ICON.edit}</button>
      <button type="button" data-a="del" class="del" title="Excluir" aria-label="Excluir">${ICON.trash}</button>
    </div>
  </article>`;
}
function renderTimeline(list){
  if (!list.length) return emptyState();
  const groups = new Map();
  list.forEach(it => { const k = it.inicio.slice(0,7); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); });
  let h = '';
  for (const [k, arr] of groups){ const [y,m] = k.split('-').map(Number);
    h += `<section class="month" id="m-${k}"><div class="month-h"><h3>${MONTHS[m-1]} ${y}</h3><span>${arr.length} ${arr.length>1?'itens':'item'}</span></div><div class="items">${arr.map(itemCard).join('')}</div></section>`; }
  return h;
}

/* ---------- render: calendário + agenda do dia ---------- */
function eventsByDay(list){
  const map = {};
  list.forEach(it => { const a = pd(it.inicio), b = pd(it.fim);
    const push = d => (map[iso(d)] ||= []).push(it);
    if ((b - a) > 3*DAY){ push(a); push(b); } else for (let d = new Date(a); d <= b; d.setDate(d.getDate()+1)) push(new Date(d)); });
  return map;
}
function renderCalendar(list){
  if (!calCursor){ const nx = list.find(isUpcoming); const base = nx ? pd(nx.inicio) : today0(); calCursor = new Date(base.getFullYear(), base.getMonth(), 1); }
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  const first = new Date(y, m, 1), start = new Date(first); start.setDate(1 - first.getDay());
  const byDay = eventsByDay(list), tIso = iso(today0());
  if (!selDay || pd(selDay).getMonth() !== m || pd(selDay).getFullYear() !== y){
    const inMonth = Object.keys(byDay).filter(k => k.startsWith(`${y}-${pad(m+1)}`)).sort();
    selDay = tIso.startsWith(`${y}-${pad(m+1)}`) ? tIso : (inMonth.find(k => k >= tIso) || inMonth[0] || iso(first));
  }
  let g = `<div class="cal-head"><h3>${MONTHS[m]} ${y}</h3>
    <button class="btn icon-btn" type="button" data-cal="-1" aria-label="Mês anterior">${ICON.prev}</button>
    <button class="btn icon-btn" type="button" data-cal="1" aria-label="Próximo mês">${ICON.next}</button></div>
    <div class="cal" id="calGrid">${DOW.map(d => `<div class="dow">${d}</div>`).join('')}`;
  for (let i = 0; i < 42; i++){ const d = new Date(start); d.setDate(start.getDate()+i); const k = iso(d);
    if (i >= 35 && d.getMonth() !== m) break;
    const evs = byDay[k] || [];
    g += `<button type="button" class="day ${d.getMonth()!==m?'out':''} ${k===tIso?'is-today':''} ${k===selDay?'sel':''}" data-day="${k}" aria-label="${d.getDate()} de ${MONTHS[d.getMonth()]}${evs.length ? ', ' + evs.length + ' item(ns)' : ''}" aria-pressed="${k===selDay}">
      <span class="n">${d.getDate()}</span>
      ${evs.map(e => `<span class="ev" style="--c:${color(e.categoria)}" data-id="${esc(e.id)}">${esc(e.titulo)}</span>`).join('')}
      <span class="dots">${evs.slice(0,4).map(e => `<i style="--c:${color(e.categoria)}"></i>`).join('')}</span>
    </button>`; }
  g += '</div>';
  const sd = pd(selDay), evs = (byDay[selDay] || []);
  const ag = `<aside class="card agenda" aria-label="Agenda do dia">
    <h4>${DOW[sd.getDay()]}, ${sd.getDate()} de ${MONTHS[sd.getMonth()]}</h4>
    <div class="sub">${evs.length ? `${evs.length} ${evs.length>1?'itens':'item'}` : 'Nenhum item neste dia'}</div>
    ${evs.length ? `<div class="ag-list">${evs.map(e => `<button type="button" class="ag-item" style="--c:${color(e.categoria)}" data-open="${esc(e.id)}"><i class="dot"></i><div><b>${esc(e.titulo)}</b><span>${esc([e.professor, slotTxt(e)].filter(Boolean).join(' · ') || CATS[e.categoria]?.label)}</span></div></button>`).join('')}</div>` : ''}
    <button class="btn sm" type="button" data-new-day="${selDay}">${ICON.plus}Adicionar neste dia</button>
  </aside>`;
  return `<div class="cal-layout"><div>${g}</div>${ag}</div>`;
}

/* ---------- render: tabela ---------- */
function renderTable(list){
  if (!list.length) return emptyState();
  const val = it => sortKey === 'categoria' ? (CATS[it.categoria]?.label || '') : (it[sortKey] ?? '');
  const arr = [...list].sort((a,b) => String(val(a)).localeCompare(String(val(b)), 'pt') * sortDir || byDate(a,b));
  const th = (k, l) => `<th aria-sort="${sortKey===k ? (sortDir>0?'ascending':'descending') : 'none'}"><button type="button" data-sort="${k}">${l}${sortKey===k ? (sortDir>0?' ↑':' ↓') : ''}</button></th>`;
  return `<div class="card tbl-wrap"><table><thead><tr>${th('inicio','Data')}${th('titulo','Título')}${th('modulo','Módulo')}${th('categoria','Tipo')}${th('professor','Professor(a)')}<th>Horários</th><th><span class="sr">Ações</span></th></tr></thead><tbody>
    ${arr.map(it => `<tr data-id="${esc(it.id)}" style="--c:${color(it.categoria)}" tabindex="0" class="${isDone(it)?'past':''}">
      <td style="white-space:nowrap" data-l="Data">${esc(fmtRange(it))}</td>
      <td class="tt tt-cell">${esc(it.titulo)}</td>
      <td data-l="Módulo">${esc(it.modulo) || '—'}</td>
      <td><span class="tag">${esc(CATS[it.categoria]?.label || 'Outro')}</span></td>
      <td data-l="Professor(a)">${esc(it.professor) || '—'}${it.modalidade==='online'?' <span class="tag plain">Online</span>':''}</td>
      <td style="font-size:13px;color:var(--muted)" data-l="Horários">${esc(slotTxt(it)) || '—'}</td>
      <td class="act-cell"><div class="it-act"><button type="button" data-a="edit" aria-label="Editar">${ICON.edit}</button><button type="button" data-a="del" class="del" aria-label="Excluir">${ICON.trash}</button></div></td></tr>`).join('')}
  </tbody></table></div>`;
}
function emptyState(){
  const f = filters(), any = f.q || f.c || f.s !== '' || f.p;
  return `<div class="card empty"><b>Nada por aqui</b>${any ? 'Nenhum item corresponde aos filtros.' : (!f.past ? 'Ative “Mostrar realizados” para ver encontros que já aconteceram.' : 'Adicione o primeiro item do calendário.')}
    <div style="margin-top:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">${any ? '<button class="btn" type="button" data-clear-filters>Limpar filtros</button>' : ''}<button class="btn primary" type="button" data-new>Novo item</button></div></div>`;
}

/* ---------- render: filtros ---------- */
function renderFilters(){
  const used = new Set(state.items.map(i => i.categoria));
  const fc = $('#fCat'), cur = fc.value;
  fc.innerHTML = '<option value="">Todos os tipos</option>' + Object.entries(CATS).filter(([k]) => used.has(k)).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('');
  fc.value = used.has(cur) ? cur : '';
  const fp = $('#fProf'), cp = fp.value;
  const profs = [...new Set(state.items.map(i => i.professor).filter(Boolean))].sort((a,b) => a.localeCompare(b,'pt'));
  fp.innerHTML = '<option value="">Todos os professores</option>' + profs.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  fp.value = profs.includes(cp) ? cp : '';
  $('#dlProfs').innerHTML = profs.map(p => `<option value="${esc(p)}">`).join('');
  $('#dlModulos').innerHTML = [...new Set(state.items.map(i => i.modulo).filter(Boolean))].map(p => `<option value="${esc(p)}">`).join('');
  $('#legend').innerHTML = Object.entries(CATS).filter(([k]) => used.has(k)).map(([k,v]) => `<button type="button" data-cat="${k}" aria-pressed="${fc.value===k}"><i class="dot" style="--c:${color(k)}"></i>${v.label}</button>`).join('');
  const f = filters(), chips = [];
  if (f.c) chips.push(['fCat', CATS[f.c].label]);
  if (f.s !== '') chips.push(['fSem', $('#fSem').selectedOptions[0].text]);
  if (f.p) chips.push(['fProf', f.p]);
  if (!f.past) chips.push(['fPast', 'Ocultando realizados']);
  $('#activeFilters').innerHTML = chips.map(([id, l]) => `<button type="button" class="af" data-rm="${id}" aria-label="Remover filtro ${esc(l)}">${esc(l)}${ICON.x}</button>`).join('');
  const n = chips.length ? String(chips.length) : '';
  $('#fCount').textContent = n; $('#fCount2').textContent = n;
  $('#searchBox').classList.toggle('has-q', !!$('#q').value);
}

/* ---------- render geral ---------- */
function render(){
  renderFilters(); renderKpis(); renderNext();
  $$('[data-view]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === view)));
  const list = view === 'calendar' ? filtered({ignorePast:true}) : filtered();
  $('#view').innerHTML = view === 'calendar' ? renderCalendar(list) : view === 'table' ? renderTable(list) : renderTimeline(list);
  const sb = $('#syncBadge'), dirty = isDirty(), off = !navigator.onLine;
  sb.classList.toggle('dirty', dirty); sb.classList.toggle('offline', off && !dirty);
  const label = dirty ? 'Alterações não publicadas' : off ? 'Offline' : 'Sincronizado';
  sb.querySelector('span').textContent = label; sb.setAttribute('aria-label', label);
  sb.title = dirty ? 'Edições salvas só neste navegador. Toque para publicar no GitHub.' : off ? 'Sem conexão: usando a cópia salva neste navegador' : 'Igual à versão publicada';
  $('#fonte').textContent = state.meta.fonte || '—';
  $('#upd').textContent = state.meta.updatedAt ? new Date(state.meta.updatedAt).toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'}) : '—';
}
function setView(v){ view = v; store.set(KEYS.view, v); render(); window.scrollTo({top: Math.min(window.scrollY, $('.toolbar').offsetTop - 70), behavior:'smooth'}); }

/* ---------- histórico: botão "voltar" do celular fecha diálogos/painéis ---------- */
let skipPop = false;
function pushLayer(name){ history.pushState({layer:name}, ''); }
function popLayer(name){ if (history.state && history.state.layer === name){ skipPop = true; history.back(); } }
window.addEventListener('popstate', () => {
  if (skipPop){ skipPop = false; return; }
  const d = document.querySelector('dialog[open]'); if (d){ d._silent = true; d.close(); }
  closeFilters(true); closeMenu();
});
function openDlg(d){
  if (d.open) return;
  const cur = document.querySelector('dialog[open]');
  if (cur && cur !== d){ cur._silent = true; cur.close(); history.replaceState({layer:d.id}, ''); }
  else if (!cur) pushLayer(d.id);
  d.showModal();
}
$$('dialog').forEach(d => {
  d.addEventListener('close', () => { if (d._silent){ d._silent = false; return; } popLayer(d.id); });
  d.addEventListener('click', e => { if (e.target === d) d.close(); });
  enableSwipeDown(d, () => d.close());
});
/* arrastar para baixo fecha bottom sheets (mobile) */
function enableSwipeDown(el, onClose){
  let y0 = null, dy = 0;
  el.addEventListener('touchstart', e => { if (!isMobile()) return; const h = e.target.closest('.grab,.m-head,.fp-head'); if (!h || e.target.closest('button,input,select')) return; y0 = e.touches[0].clientY; dy = 0; el.style.transition = 'none'; }, {passive:true});
  el.addEventListener('touchmove', e => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); el.style.transform = `translateY(${dy}px)`; }, {passive:true});
  el.addEventListener('touchend', () => { if (y0 === null) return; el.style.transition = ''; el.style.transform = ''; if (dy > 90) onClose(); y0 = null; });
}

/* ---------- painel de filtros (bottom sheet no mobile) ---------- */
function openFilters(){ if (!isMobile()){ $('#fCat').focus(); return; } $('#filterPanel').classList.add('open'); $('#backdrop').classList.add('show'); $('#btnFilters').setAttribute('aria-expanded','true'); pushLayer('filters'); }
function closeFilters(fromPop){ const p = $('#filterPanel'); if (!p.classList.contains('open')) return; p.classList.remove('open'); $('#backdrop').classList.remove('show'); $('#btnFilters').setAttribute('aria-expanded','false'); if (!fromPop) popLayer('filters'); }
enableSwipeDown($('#filterPanel'), () => closeFilters());
function clearFilters(){ $('#fCat').value = ''; $('#fSem').value = ''; $('#fProf').value = ''; $('#q').value = ''; $('#fPast').checked = true; store.set(KEYS.past,'1'); render(); }

/* ---------- menu ---------- */
function openMenu(){ $('#menuPop').classList.add('open'); $('#btnMenu').setAttribute('aria-expanded','true'); $('#menuPop button:not([hidden])').focus(); }
function closeMenu(){ $('#menuPop').classList.remove('open'); $('#btnMenu').setAttribute('aria-expanded','false'); }

/* ---------- CRUD ---------- */
function fillSelects(){
  $('#eCat').innerHTML = Object.entries(CATS).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('');
  $('#eSlots').innerHTML = Object.entries(SLOTS).map(([k,v]) => `<label><input type="checkbox" value="${k}"> ${v.label}</label>`).join('');
}
function clearErrors(){ $$('#formEdit .field.invalid').forEach(f => f.classList.remove('invalid')); }
function openEdit(id, preset={}){
  editingId = id || null;
  const it = id ? state.items.find(i => i.id === id) : normItem({titulo:'x', inicio: preset.inicio || iso(today0()), categoria:'outro'});
  if (!it) return;
  clearErrors();
  $('#editTitle').textContent = id ? 'Editar item' : 'Novo item';
  $('#eTitulo').value = id ? it.titulo : ''; $('#eModulo').value = it.modulo; $('#eCat').value = it.categoria;
  $('#eIni').value = it.inicio; $('#eFim').value = it.fim !== it.inicio ? it.fim : '';
  $$('#eSlots input').forEach(c => c.checked = it.horarios.includes(c.value));
  $('#eProf').value = it.professor; $('#eMod').value = it.modalidade; $('#eSem').value = String(it.semestre);
  $('#eStatus').value = it.status; $('#eLocal').value = it.local; $('#eNotas').value = it.notas;
  $('#btnDel').hidden = !id; $('#btnDup').hidden = !id;
  openDlg($('#dlgEdit'));
  if (!isMobile()) setTimeout(() => $('#eTitulo').focus(), 50);
}
function readForm(){
  return normItem({ titulo:$('#eTitulo').value, modulo:$('#eModulo').value, categoria:$('#eCat').value, inicio:$('#eIni').value, fim:$('#eFim').value || $('#eIni').value,
    horarios:$$('#eSlots input:checked').map(c => c.value), professor:$('#eProf').value, modalidade:$('#eMod').value,
    semestre:$('#eSem').value, local:$('#eLocal').value, notas:$('#eNotas').value, status:$('#eStatus').value, id: editingId || uid() });
}
function validate(){
  clearErrors(); let ok = true;
  const bad = (id) => { $(id).classList.add('invalid'); if (ok) $(id).querySelector('input').focus(); ok = false; };
  if (!$('#eTitulo').value.trim()) bad('#fTitulo');
  if (!validDate($('#eIni').value)) bad('#fIni');
  else if ($('#eFim').value && $('#eFim').value < $('#eIni').value) bad('#fFim');
  return ok;
}
$('#formEdit').addEventListener('submit', e => {
  e.preventDefault();
  if (!validate()){ haptic(); return; }
  const d = readForm();
  if (editingId){ const i = state.items.findIndex(x => x.id === editingId); if (i >= 0) state.items[i] = d; toast('Item atualizado'); }
  else { state.items.push(d); toast('Item adicionado'); }
  haptic(); $('#dlgEdit').close(); saveLocal(); reveal(d.id);
});
$('#formEdit').addEventListener('input', e => { const f = e.target.closest('.field.invalid'); if (f) f.classList.remove('invalid'); });
function delItem(id){
  const idx = state.items.findIndex(i => i.id === id); if (idx < 0) return;
  const [it] = state.items.splice(idx, 1);
  $$('dialog[open]').forEach(d => d.close());
  haptic(); saveLocal();
  toast(`“${it.titulo}” excluído`, {action:'Desfazer', onAction: () => { state.items.splice(idx, 0, it); saveLocal(); toast('Exclusão desfeita'); }});
}
function toggleDone(id){
  const it = state.items.find(i => i.id === id); if (!it) return;
  it.status = it.status === 'concluido' ? 'auto' : 'concluido'; haptic(); saveLocal();
  toast(it.status === 'concluido' ? 'Marcado como concluído' : 'Status automático pela data');
}
$('#btnDel').onclick = () => editingId && delItem(editingId);
$('#btnDup').onclick = () => {
  if (!editingId || !validate()) return;
  const d = readForm(); d.id = uid(); d.titulo = (d.titulo + ' (cópia)').slice(0,140); d.status = 'auto';
  state.items.push(d); saveLocal(); openEdit(d.id); toast('Item duplicado — ajuste a data');
};

/* detalhe */
function openView(id){
  const it = state.items.find(i => i.id === id); if (!it) return;
  viewingId = id;
  $('#vTitle').textContent = it.titulo;
  const st = {passado:'Realizado', concluido:'Concluído', hoje:'Hoje', futuro:'Agendado', cancelado:'Cancelado / adiado'}[statusOf(it)];
  const loc = it.local ? (safeUrl(it.local) ? `<a href="${esc(it.local)}" target="_blank" rel="noopener noreferrer">${esc(it.local)}</a>` : esc(it.local)) : '—';
  $('#vBody').innerHTML = `<div class="it-top" style="--c:${color(it.categoria)}">${tagsFor(it)}</div><dl>
    <dt>Data</dt><dd>${esc(fmtRange(it,true))}</dd>
    ${slotTxt(it) ? `<dt>Horários</dt><dd>${esc(slotTxt(it))}</dd>` : ''}
    ${it.modulo ? `<dt>Módulo</dt><dd>${esc(it.modulo)}</dd>` : ''}
    ${it.professor ? `<dt>Professor(a)</dt><dd>${esc(it.professor)}</dd>` : ''}
    <dt>Modalidade</dt><dd>${MODS[it.modalidade]}</dd>
    <dt>Local</dt><dd>${loc}</dd>
    <dt>Status</dt><dd>${st}</dd>
    ${it.notas ? `<dt>Anotações</dt><dd style="white-space:pre-wrap">${esc(it.notas)}</dd>` : ''}</dl>`;
  $('#vDone').innerHTML = `${ICON.check}${it.status === 'concluido' ? 'Desmarcar' : 'Concluir'}`;
  openDlg($('#dlgView'));
}
$('#vEdit').onclick = () => viewingId && openEdit(viewingId);
$('#vDel').onclick = () => viewingId && delItem(viewingId);
$('#vDone').onclick = () => { if (!viewingId) return; toggleDone(viewingId); openView(viewingId); };
$('#vIcs').onclick = () => { const it = state.items.find(i => i.id === viewingId); if (it) download(`${slug(it.titulo)}.ics`, buildIcs([it]), 'text/calendar'); };

/* destacar item após salvar */
function reveal(id){
  requestAnimationFrame(() => {
    const el = document.querySelector(`#view [data-id="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({behavior:'smooth', block:'center'});
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  });
}
function goToday(){
  if (view === 'calendar'){ const t = today0(); calCursor = new Date(t.getFullYear(), t.getMonth(), 1); selDay = iso(t); render(); return; }
  const target = filtered().find(isUpcoming);
  if (target) reveal(target.id); else toast('Nenhum item futuro na lista atual');
}

/* ---------- eventos ---------- */
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-close]')){ t.closest('dialog').close(); return; }
  if (t.closest('[data-fp-close]')){ closeFilters(); return; }
  if (t.closest('[data-new]')){ openEdit(null); return; }
  if (t.closest('[data-clear-filters]')){ clearFilters(); return; }
  const nd = t.closest('[data-new-day]'); if (nd){ openEdit(null, {inicio: nd.dataset.newDay}); return; }
  const rm = t.closest('[data-rm]'); if (rm){ const id = rm.dataset.rm; if (id === 'fPast'){ $('#fPast').checked = true; store.set(KEYS.past,'1'); } else $('#'+id).value = ''; render(); return; }
  const cat = t.closest('[data-cat]'); if (cat){ $('#fCat').value = $('#fCat').value === cat.dataset.cat ? '' : cat.dataset.cat; haptic(); render(); return; }
  const cal = t.closest('[data-cal]'); if (cal){ shiftMonth(Number(cal.dataset.cal)); return; }
  const op = t.closest('[data-open]'); if (op){ openView(op.dataset.open); return; }
  const ev = t.closest('.ev'); if (ev && !isMobile()){ openView(ev.dataset.id); return; }
  const day = t.closest('.day'); if (day){ selDay = day.dataset.day; haptic(); render(); if (isMobile()) $('.agenda')?.scrollIntoView({behavior:'smooth', block:'nearest'}); return; }
  const th = t.closest('[data-sort]'); if (th){ if (sortKey === th.dataset.sort) sortDir *= -1; else { sortKey = th.dataset.sort; sortDir = 1; } render(); return; }
  const act = t.closest('[data-a]'), row = t.closest('#view [data-id]');
  if (act && row){ const id = row.dataset.id, a = act.dataset.a;
    if (a === 'edit') openEdit(id); else if (a === 'del') delItem(id); else if (a === 'done') toggleDone(id);
    return; }
  if (row){ openView(row.dataset.id); return; }
  if (!t.closest('.menu')) closeMenu();
});
document.addEventListener('dblclick', e => { const day = e.target.closest('.day'); if (day && !isMobile() && !e.target.closest('.ev')) openEdit(null, {inicio: day.dataset.day}); });
document.addEventListener('keydown', e => {
  const typing = e.target.closest('input,textarea,select,[contenteditable]');
  if (e.key === 'Escape'){ closeMenu(); closeFilters(); }
  if ((e.key === 'Enter' || e.key === ' ') && !typing){
    const row = e.target.closest('#view [data-id]'); if (row && !e.target.closest('button')){ e.preventDefault(); openView(row.dataset.id); return; }
    if (e.target.id === 'nextCard' && e.target.dataset.id){ e.preventDefault(); openView(e.target.dataset.id); return; }
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
  if (e.key === 'n'){ e.preventDefault(); openEdit(null); }
  else if (e.key === '/'){ e.preventDefault(); $('#q').focus(); }
  else if (e.key === 't'){ goToday(); }
  else if (view === 'calendar' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.target.closest('.day')) shiftMonth(e.key === 'ArrowLeft' ? -1 : 1);
});
function shiftMonth(v){ calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth()+v, 1); selDay = null; haptic(); render(); }

/* deslizar no calendário troca o mês */
(() => { let x0 = null, y0 = 0;
  $('#view').addEventListener('touchstart', e => { if (view !== 'calendar' || !e.target.closest('#calGrid')) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, {passive:true});
  $('#view').addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftMonth(dx < 0 ? 1 : -1); });
})();

$$('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
const rerender = debounce(render, 140);
$('#q').addEventListener('input', rerender);
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
$('#qClear').onclick = () => { $('#q').value = ''; render(); $('#q').focus(); };
['fCat','fSem','fProf'].forEach(id => $('#'+id).addEventListener('change', render));
$('#fPast').addEventListener('change', e => { store.set(KEYS.past, e.target.checked ? '1' : '0'); render(); });
$('#fpClear').onclick = clearFilters;
$('#btnFilters').onclick = $('#bnFilters').onclick = openFilters;
$('#backdrop').onclick = () => closeFilters();
$('#btnToday').onclick = goToday;
$('#btnNew').onclick = $('#bnAdd').onclick = () => openEdit(null);
$('#nextCard').onclick = () => { const id = $('#nextCard').dataset.id; if (id) openView(id); };
$('#syncBadge').onclick = () => isDirty() ? publish() : toast(navigator.onLine ? 'Tudo publicado' : 'Sem conexão no momento');
$('#btnMenu').onclick = e => { e.stopPropagation(); $('#menuPop').classList.contains('open') ? closeMenu() : openMenu(); };
$('#menuPop').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; closeMenu(); menuAct(b.dataset.act); });
$('#menuPop').addEventListener('keydown', e => {
  const items = $$('#menuPop button:not([hidden])'), i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown'){ e.preventDefault(); items[(i+1) % items.length].focus(); }
  if (e.key === 'ArrowUp'){ e.preventDefault(); items[(i-1+items.length) % items.length].focus(); }
});

/* tema */
function applyTheme(t){ if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
$('#btnTheme').onclick = () => {
  const cur = document.documentElement.dataset.theme;
  const dark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const t = dark ? 'light' : 'dark'; store.set(KEYS.theme, t); applyTheme(t);
};

/* sincroniza entre abas abertas */
window.addEventListener('storage', e => { if (e.key !== KEYS.data || !e.newValue) return; try { state = normData(JSON.parse(e.newValue)).data; render(); } catch(_){} });
window.addEventListener('online', () => { render(); toast('Conexão restabelecida'); });
window.addEventListener('offline', () => { render(); toast('Sem conexão — as edições continuam salvas aqui'); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderNext(); });

/* ---------- ações do menu ---------- */
const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'item';
function download(name, text, type){
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('#btnInstall').hidden = false; });
async function menuAct(a){
  if (a === 'export') download(`mpes-2026-2-backup-${iso(new Date())}.json`, JSON.stringify(state, null, 2), 'application/json');
  if (a === 'import') $('#fileImport').click();
  if (a === 'ics') download('mpes-2026-2.ics', buildIcs(state.items), 'text/calendar');
  if (a === 'print') window.print();
  if (a === 'gh') openGh();
  if (a === 'sync') publish();
  if (a === 'install' && installEvt){ installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; $('#btnInstall').hidden = true; }
  if (a === 'reload'){
    try { const r = await fetchRemote(); remote = clone(r);
      if (isDirty() && !confirm('Há alterações locais não publicadas. Substituir pela versão publicada?')) { render(); return; }
      state = clone(r); store.del(KEYS.data); render(); toast('Versão publicada carregada');
    } catch(_){ toast('Não foi possível buscar a versão publicada'); }
  }
  if (a === 'reset'){
    if (!remote){ toast('Versão publicada indisponível'); return; }
    if (!confirm('Descartar as edições deste navegador e voltar à versão publicada?')) return;
    state = clone(remote); store.del(KEYS.data); render(); toast('Versão publicada restaurada');
  }
}
$('#fileImport').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (f.size > 2e6){ toast('Arquivo grande demais'); return; }
  try {
    const raw = JSON.parse(await f.text()); const n = normData(Array.isArray(raw) ? {items:raw} : raw);
    if (!n.data.items.length) throw new Error('vazio');
    if (!confirm(`Importar ${n.data.items.length} itens? Isso substitui o calendário atual deste navegador.`)) return;
    const prev = clone(state);
    state = {meta:{...state.meta, ...n.data.meta}, items:n.data.items}; saveLocal();
    toast(`${n.data.items.length} itens importados${n.dropped ? ` · ${n.dropped} ignorados` : ''}`, {action:'Desfazer', onAction: () => { state = prev; saveLocal(); }});
  } catch(_){ toast('Arquivo inválido: esperado um backup JSON deste calendário'); }
};

function buildIcs(items){
  const dt = (d, hm) => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${hm.replace(':','')}00`;
  const dd = d => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  const txt = s => String(s || '').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g, m => '\\' + m);
  const fold = l => { const out = []; while (l.length > 74){ out.push(l.slice(0,74)); l = ' ' + l.slice(74); } out.push(l); return out.join('\r\n'); };
  const now = new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
  const L = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MPES 2026.2//Calendario//PT-BR','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:MPES 2026.2 · CESAR School','X-WR-TIMEZONE:America/Recife',
    'BEGIN:VTIMEZONE','TZID:America/Recife','BEGIN:STANDARD','DTSTART:19700101T000000','TZOFFSETFROM:-0300','TZOFFSETTO:-0300','TZNAME:-03','END:STANDARD','END:VTIMEZONE'];
  items.filter(i => i.status !== 'cancelado').forEach(it => {
    const desc = [it.modulo, it.professor && 'Professor(a): ' + it.professor, it.modalidade !== 'presencial' && MODS[it.modalidade], it.notas].filter(Boolean).join('\n');
    const slots = it.horarios.map(k => [k, SLOTS[k]]).filter(x => x[1]); let n = 0;
    const ev = (uidv, start, end) => L.push('BEGIN:VEVENT', `UID:${uidv}@mpes2026`, `DTSTAMP:${now}`, start, end, fold(`SUMMARY:${txt(it.titulo)}`), fold(`DESCRIPTION:${txt(desc)}`), ...(it.local ? [fold(`LOCATION:${txt(it.local)}`)] : []), 'END:VEVENT');
    for (let d = pd(it.inicio); d <= pd(it.fim); d.setDate(d.getDate()+1)) slots.forEach(([k,s]) => { if (d.getDay() !== s.dow) return; n++;
      ev(`${it.id}-${k}-${dd(d)}`, `DTSTART;TZID=America/Recife:${dt(d,s.s)}`, `DTEND;TZID=America/Recife:${dt(d,s.e)}`); });
    if (!n){ const e = pd(it.fim); e.setDate(e.getDate()+1); ev(it.id, `DTSTART;VALUE=DATE:${dd(pd(it.inicio))}`, `DTEND;VALUE=DATE:${dd(e)}`); }
  });
  L.push('END:VCALENDAR'); return L.join('\r\n') + '\r\n';
}

/* ---------- sincronização com GitHub ---------- */
function ghCfg(){
  const c = store.getJSON(KEYS.gh) || {};
  if (!c.owner && location.hostname.endsWith('github.io')){ c.owner = location.hostname.split('.')[0]; c.repo = location.pathname.split('/').filter(Boolean)[0] || `${c.owner}.github.io`; }
  return {branch:'main', path:'data.json', ...c};
}
function openGh(){ const c = ghCfg(); $('#gOwner').value = c.owner || ''; $('#gRepo').value = c.repo || ''; $('#gBranch').value = c.branch || 'main'; $('#gPath').value = c.path || 'data.json'; $('#gToken').value = c.token || ''; openDlg($('#dlgGh')); }
$('#formGh').addEventListener('submit', e => { e.preventDefault();
  const c = {owner:$('#gOwner').value.trim(), repo:$('#gRepo').value.trim(), branch:$('#gBranch').value.trim() || 'main', path:$('#gPath').value.trim() || 'data.json', token:$('#gToken').value.trim()};
  if (!/^[\w.-]+$/.test(c.owner) || !/^[\w.-]+$/.test(c.repo)){ toast('Usuário ou repositório inválido'); return; }
  store.set(KEYS.gh, c); $('#dlgGh').close(); toast('Configuração salva neste navegador'); });
$('#gForget').onclick = () => { const c = ghCfg(); delete c.token; store.set(KEYS.gh, c); $('#gToken').value = ''; toast('Token removido'); };
const b64 = s => { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const unb64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g,'')), c => c.charCodeAt(0)));
let publishing = false;
async function publish(){
  if (publishing) return;
  const c = ghCfg(); if (!c.token || !c.owner || !c.repo){ toast('Configure a sincronização com o GitHub primeiro'); openGh(); return; }
  if (!navigator.onLine){ toast('Sem conexão — publique quando voltar a internet'); return; }
  const url = `https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${c.path.split('/').map(encodeURIComponent).join('/')}`;
  const H = {Authorization:`Bearer ${c.token}`, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28'};
  publishing = true; toast('Publicando…', {ms:15000});
  try {
    let sha; const g = await fetch(`${url}?ref=${encodeURIComponent(c.branch)}`, {headers:H, cache:'no-store'});
    if (g.status === 401) throw new Error('token inválido ou expirado');
    if (g.status === 403) throw new Error('token sem permissão neste repositório');
    if (g.ok){
      const j = await g.json(); sha = j.sha;
      /* proteção contra sobrescrever edições feitas em outro dispositivo */
      try { const cur = normData(JSON.parse(unb64(j.content || ''))).data;
        if (remote && !sameItems(cur.items, remote.items) && !sameItems(cur.items, state.items)
            && !confirm('A versão publicada mudou desde que você abriu a página (talvez editada em outro dispositivo). Publicar mesmo assim e substituí-la?')){ toast('Publicação cancelada'); return; }
      } catch(_){}
    } else if (g.status !== 404) throw new Error(`GitHub respondeu ${g.status}`);
    stamp();
    const body = {message:`Atualiza calendário MPES (${new Date().toLocaleString('pt-BR')})`, content:b64(JSON.stringify(state, null, 2) + '\n'), branch:c.branch}; if (sha) body.sha = sha;
    const p = await fetch(url, {method:'PUT', headers:{...H, 'Content-Type':'application/json'}, body:JSON.stringify(body)});
    if (p.status === 409) throw new Error('conflito de versão — tente novamente');
    if (!p.ok){ const j = await p.json().catch(() => ({})); throw new Error(j.message || `GitHub respondeu ${p.status}`); }
    remote = clone(state); store.set(KEYS.data, state); render(); haptic();
    toast('Publicado! O site atualiza em 1–2 minutos.', {ms:4000});
  } catch(err){ toast('Falha ao publicar: ' + err.message, {ms:6000}); }
  finally { publishing = false; }
}

/* ---------- PWA: funciona offline e pode ser instalado ---------- */
if ('serviceWorker' in navigator && location.protocol === 'https:'){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => { const w = reg.installing; if (!w) return;
        w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller)
          toast('Nova versão disponível', {action:'Atualizar', ms:15000, onAction: () => location.reload()}); }); });
    }).catch(() => {});
  });
}

/* ---------- inicialização ---------- */
const sp = store.get(KEYS.past); if (sp !== null) $('#fPast').checked = sp === '1';
fillSelects();
load();
setInterval(() => { if (!document.hidden) renderNext(); }, 30000);
let lastDay = iso(today0());
setInterval(() => { const d = iso(today0()); if (d !== lastDay){ lastDay = d; render(); } }, 60000);
})();
