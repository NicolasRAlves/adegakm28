// Auditoria sem Lighthouse: velocidade (4G + CPU 4x mais lenta) e acessibilidade (axe-core).
// Uso: node ferramentas/auditar.mjs caminho/para/axe.min.js
//   (axe-core: https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js)
import { readFileSync } from 'node:fs';
import { abrirChrome } from './chrome.mjs';
import { iniciarServidor } from './servidor.mjs';

const AXE = process.argv[2];
const PORTA = 8766;
const BASE = `http://localhost:${PORTA}/`;
const srv = await iniciarServidor(PORTA);
const c = await abrirChrome();

try {
  // ---------- velocidade: primeira visita, sem cache ----------
  await c.tela(360, 760, { escala: 2, movel: true });
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8,
  });
  await c.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  let bytes = 0;
  const parar = c.ouvir((d) => { if (d.method === 'Network.loadingFinished') bytes += d.params.encodedDataLength; });
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__m = { cls: 0 };
    window.__m.lcps = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) {
      window.__m.lcp = e.startTime;
      const el = e.element;
      window.__m.lcps.push(Math.round(e.startTime) + 'ms ' + (el ? el.tagName + '.' + el.className + ' "' + (el.textContent || '').trim().slice(0, 25) + '"' : '?'));
    } }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new MutationObserver((_, o) => { if (document.querySelector('.item')) { window.__m.cardapio = performance.now(); o.disconnect(); } }).observe(document, { childList: true, subtree: true });
  ` });
  await c.ir(BASE);
  await c.espera(1500);
  const m = await c.avaliar(`({ ...window.__m, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime })`);
  parar();
  console.log('Velocidade (360 px, 4G simulado, CPU 4x mais lenta, sem cache):');
  console.log(`  primeira pintura (FCP) ....... ${Math.round(m.fcp)} ms`);
  console.log(`  maior pintura (LCP) .......... ${Math.round(m.lcp)} ms`);
  console.log(`  cardápio na tela ............. ${Math.round(m.cardapio)} ms`);
  console.log(`  deslocamento de layout (CLS) . ${m.cls.toFixed(3)}`);
  console.log(`  bytes transferidos ........... ${Math.round(bytes / 1024)} KB`);
  console.log(`  elemento da maior pintura .... ${m.lcps.at(-1)}`);
  if (process.env.DETALHE) console.log(m.lcps);
  await c.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await c.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  // ---------- acessibilidade (axe-core) em cada tela ----------
  if (AXE) {
    const axe = readFileSync(AXE, 'utf8');
    const rodar = async (nome, contexto = 'document') => {
      await c.avaliar(`window.axe ? true : (eval(${JSON.stringify(axe)}), true)`);
      const r = await c.avaliar(`axe.run(${contexto}, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }).then(r => r.violations.map(v => ({ id: v.id, impacto: v.impact, ajuda: v.help, alvos: v.nodes.slice(0,3).map(n => n.target.join(' ')) })))`);
      console.log(`\nAcessibilidade · ${nome}: ${r.length ? `${r.length} problema(s)` : 'nenhum problema'}`);
      for (const v of r) console.log(`  [${v.impacto}] ${v.id}: ${v.ajuda}\n      ${v.alvos.join('\n      ')}`);
      return r.length;
    };
    let total = 0;
    await c.ir(BASE);
    total += await rodar('portão de idade', 'document.querySelector("#dlg-idade")');
    await c.avaliar('document.querySelector("#idade-sim").click(); true');
    await c.espera(300);
    total += await rodar('cardápio');
    await c.avaliar('document.querySelector("[data-id=gin-rocks] [data-acao=mais]").click(); true');
    await c.espera(300);
    total += await rodar('opções do produto', 'document.querySelector("#dlg-produto")');
    await c.avaliar('document.querySelector("label[for=op-0-0]").click(); document.querySelector("#s-add").click(); true');
    await c.espera(300);
    await c.avaliar('document.querySelector("#abrir-carrinho").click(); true');
    await c.espera(300);
    total += await rodar('carrinho', 'document.querySelector("#dlg-carrinho")');
    await c.avaliar('document.querySelector("#dlg-carrinho [data-acao=finalizar]").click(); true');
    await c.espera(300);
    total += await rodar('finalização', 'document.querySelector("#dlg-checkout")');
    process.exitCode = total ? 1 : 0;
  }
} finally {
  await c.fechar();
  srv.close();
}
