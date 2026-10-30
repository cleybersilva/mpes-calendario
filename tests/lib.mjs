/* utilidades compartilhadas pelos scripts de CI */
import { appendFileSync } from 'node:fs';

export const ROOT = new URL('..', import.meta.url).pathname;

/* escreve no resumo visual da execução no GitHub Actions (aba Summary) */
export function summary(md) {
  const f = process.env.GITHUB_STEP_SUMMARY;
  if (f) appendFileSync(f, md + '\n');
}

export function makeReporter(title) {
  const rows = [];
  let failed = 0;
  return {
    ok(name, detail = '') { rows.push(['✅', name, detail]); console.log(`  ✔ ${name}${detail ? ' — ' + detail : ''}`); },
    fail(name, detail = '') { failed++; rows.push(['❌', name, detail]); console.error(`  ✘ ${name}${detail ? ' — ' + detail : ''}`); if (process.env.GITHUB_ACTIONS) console.log(`::error title=${title}::${name}${detail ? ' — ' + detail : ''}`); },
    check(cond, name, detail = '') { cond ? this.ok(name, detail) : this.fail(name, detail); },
    finish(exit = true) {
      const esc = s => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
      summary(`### ${failed ? '❌' : '✅'} ${title}\n\n| | Verificação | Detalhe |\n| --- | --- | --- |\n${rows.map(r => `| ${r[0]} | ${esc(r[1])} | ${esc(r[2])} |`).join('\n')}\n`);
      console.log(`\n${title}: ${rows.length - failed}/${rows.length} ok`);
      if (failed && exit) process.exit(1);
      return failed;
    }
  };
}
