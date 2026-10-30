/* =========================================================
   MPES 2026.2 · Agenda — sessões, arquivo .ics e links para
   Google Agenda, Outlook, Microsoft 365 e Yahoo.
   Usado pela página (script comum) e pelo build da pipeline
   (Node), que gera o feed de assinatura calendario.ics.
   ========================================================= */
(function (root) {
  'use strict';
  const TZ = 'America/Recife', OFFSET = '-03:00'; // Recife não tem horário de verão
  const SLOTS = {
    qua:{label:'Qua 19h–21h', dow:3, s:'19:00', e:'21:00'},
    sex1:{label:'Sex 14h–17h', dow:5, s:'14:00', e:'17:00'},
    sex2:{label:'Sex 18h–21h', dow:5, s:'18:00', e:'21:00'},
    sab1:{label:'Sáb 08h–12h', dow:6, s:'08:00', e:'12:00'},
    sab2:{label:'Sáb 13h–18h', dow:6, s:'13:00', e:'18:00'}
  };
  const MODS = { presencial:'Presencial', online:'Online', hibrido:'Híbrido', adefinir:'A definir' };
  const DOW = ['dom','seg','ter','qua','qui','sex','sáb'];
  const MON = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const pad = n => String(n).padStart(2, '0');
  const pd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const iso = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const compact = s => s.replace(/-/g, '');
  const addDays = (s, n) => { const d = pd(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const hm = t => { const [h, m] = t.split(':'); return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`; };
  const plus1h = t => `${pad(Math.min(23, Number(t.slice(0, 2)) + 1))}:${t.slice(3)}`;

  /* Cada encontro vira uma ou mais sessões: um turno num dia, um horário avulso, ou o dia inteiro */
  function sessions(it) {
    if (!it || it.status === 'cancelado') return [];
    const out = [], fim = it.fim || it.inicio;
    for (let d = pd(it.inicio); iso(d) <= fim; d.setUTCDate(d.getUTCDate() + 1)) {
      const day = iso(d), dow = d.getUTCDay();
      for (const k of it.horarios || []) { const s = SLOTS[k]; if (s && s.dow === dow) out.push({ key:`${k}-${compact(day)}`, date:day, s:s.s, e:s.e }); }
      if (it.horaIni) out.push({ key:`avulso-${compact(day)}`, date:day, s:it.horaIni, e:it.horaFim || plus1h(it.horaIni), approxEnd: !it.horaFim });
    }
    out.sort((a, b) => (a.date + a.s).localeCompare(b.date + b.s));
    if (!out.length) out.push({ key:'dia', date:it.inicio, endDate:addDays(fim, 1), allDay:true });
    return out;
  }
  function sessionLabel(x) {
    const d = pd(x.date), base = `${DOW[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    if (x.allDay) { const last = addDays(x.endDate, -1); if (last === x.date) return `${base} · dia inteiro`; const l = pd(last); return `${base} a ${DOW[l.getUTCDay()]}, ${l.getUTCDate()} ${MON[l.getUTCMonth()]} ${l.getUTCFullYear()}`; }
    return `${base} · ${hm(x.s)}–${hm(x.e)}`;
  }
  function description(it, ctx = {}) {
    const team = it.equipe && (ctx.equipes || []).find(t => t.id === it.equipe);
    return [it.modulo, team && `Equipe: ${team.nome} (${team.membros.length} participantes)`, it.professor && `Professor(a): ${it.professor}`,
      it.modalidade && !['presencial', 'adefinir'].includes(it.modalidade) && MODS[it.modalidade], it.notas, ctx.siteUrl && `Calendário MPES 2026.2: ${ctx.siteUrl}`]
      .filter(Boolean).join('\n');
  }

  /* ---------- arquivo .ics (RFC 5545) ---------- */
  function build(items, ctx = {}) {
    const txt = s => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, m => '\\' + m);
    /* dobra linhas em até 75 bytes UTF-8 (RFC 5545 §3.1), sem partir caracteres acentuados */
    const enc = new TextEncoder();
    const fold = l => { const out = []; let cur = '', n = 0;
      for (const ch of l) { const b = enc.encode(ch).length; if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; n = 0; } cur += ch; n += b; }
      out.push(cur); return out.join('\r\n '); };
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MPES 2026.2//Calendario//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      fold(`X-WR-CALNAME:${txt(ctx.name || 'MPES 2026.2 · CESAR School')}`), `X-WR-TIMEZONE:${TZ}`,
      fold(`X-WR-CALDESC:${txt('Aulas, orientações e trabalhos do Mestrado Profissional em Engenharia de Software — CESAR School')}`),
      'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
      'BEGIN:VTIMEZONE', `TZID:${TZ}`, 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:-0300', 'TZOFFSETTO:-0300', 'TZNAME:-03', 'END:STANDARD', 'END:VTIMEZONE'];
    for (const it of items) {
      const desc = description(it, ctx);
      for (const x of sessions(it)) {
        L.push('BEGIN:VEVENT', `UID:${it.id}-${x.key}@mpes2026`, `DTSTAMP:${stamp}`,
          ...(x.allDay ? [`DTSTART;VALUE=DATE:${compact(x.date)}`, `DTEND;VALUE=DATE:${compact(x.endDate)}`]
                       : [`DTSTART;TZID=${TZ}:${compact(x.date)}T${x.s.replace(':', '')}00`, `DTEND;TZID=${TZ}:${compact(x.date)}T${x.e.replace(':', '')}00`]),
          fold(`SUMMARY:${txt(it.titulo)}`), ...(desc ? [fold(`DESCRIPTION:${txt(desc)}`)] : []),
          ...(it.local ? [fold(`LOCATION:${txt(it.local)}`)] : []), ...(ctx.siteUrl ? [fold(`URL:${ctx.siteUrl}`)] : []),
          'END:VEVENT');
      }
    }
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  /* ---------- links "adicionar evento" ---------- */
  function links(it, x, ctx = {}) {
    const q = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const title = it.titulo, details = description(it, ctx), location = it.local || '';
    const utc = (date, t) => { const d = new Date(`${date}T${t}:00${OFFSET}`); return d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'); };
    const google = 'https://calendar.google.com/calendar/render?' + q({ action:'TEMPLATE', text:title, details, location, ctz:TZ,
      dates: x.allDay ? `${compact(x.date)}/${compact(x.endDate)}` : `${compact(x.date)}T${x.s.replace(':', '')}00/${compact(x.date)}T${x.e.replace(':', '')}00` });
    const ms = host => `https://${host}/calendar/0/deeplink/compose?` + q({ path:'/calendar/action/compose', rru:'addevent', subject:title, body:details, location,
      startdt: x.allDay ? x.date : `${x.date}T${x.s}:00${OFFSET}`, enddt: x.allDay ? x.endDate : `${x.date}T${x.e}:00${OFFSET}`, allday: x.allDay ? 'true' : 'false' });
    const yahoo = 'https://calendar.yahoo.com/?' + q(x.allDay ? { v:60, title, desc:details, in_loc:location, st:compact(x.date), dur:'allday' }
      : { v:60, title, desc:details, in_loc:location, st:utc(x.date, x.s), et:utc(x.date, x.e) });
    return { google, outlook: ms('outlook.live.com'), office: ms('outlook.office.com'), yahoo };
  }

  /* ---------- assinatura do feed (atualiza sozinho) ---------- */
  function subscribe(feedUrl, name = 'MPES 2026.2 · CESAR School') {
    const webcal = feedUrl.replace(/^https?:/, 'webcal:');
    return {
      feed: feedUrl, webcal,
      google: 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(webcal),
      outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=${encodeURIComponent(name)}`,
      office: `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=${encodeURIComponent(name)}`
    };
  }

  root.MPESICS = { SLOTS, MODS, TZ, sessions, sessionLabel, description, build, links, subscribe };
})(typeof globalThis !== 'undefined' ? globalThis : window);
