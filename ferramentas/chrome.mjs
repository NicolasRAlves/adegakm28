// Controle mínimo do Chrome (DevTools Protocol) sem dependências.
// Usado para gerar as imagens (ícones, Open Graph, arte de Status, PDF) e testar os fluxos.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CANDIDATOS = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export async function abrirChrome() {
  const exe = CANDIDATOS.find((c) => existsSync(c));
  if (!exe) throw new Error('Chrome não encontrado. Defina a variável CHROME com o caminho.');
  const porta = 9300 + Math.floor(Math.random() * 500);
  const perfil = mkdtempSync(join(tmpdir(), 'km28-chrome-'));
  const proc = spawn(exe, [
    '--headless=new', `--remote-debugging-port=${porta}`, '--remote-allow-origins=*',
    `--user-data-dir=${perfil}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--hide-scrollbars', '--font-render-hinting=none', 'about:blank',
  ], { stdio: 'ignore' });

  let alvo;
  for (let i = 0; i < 60 && !alvo; i++) {
    await espera(150);
    try {
      const lista = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json();
      alvo = lista.find((t) => t.type === 'page');
    } catch { /* ainda subindo */ }
  }
  if (!alvo) throw new Error('Chrome não respondeu');

  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((ok, erro) => { ws.onopen = ok; ws.onerror = erro; });
  let seq = 0;
  const pendentes = new Map();
  const ouvintes = new Set();
  const consoleMsgs = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendentes.has(d.id)) {
      const { ok, erro } = pendentes.get(d.id);
      pendentes.delete(d.id);
      if (d.error) erro(new Error(`${d.error.message}`)); else ok(d.result);
    } else {
      if (d.method === 'Runtime.consoleAPICalled') consoleMsgs.push(`${d.params.type}: ${d.params.args.map((a) => a.value ?? a.description).join(' ')}`);
      if (d.method === 'Runtime.exceptionThrown') consoleMsgs.push(`EXCEÇÃO: ${d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text}`);
      for (const f of ouvintes) f(d);
    }
  };
  const send = (method, params = {}) => new Promise((ok, erro) => {
    const id = ++seq;
    pendentes.set(id, { ok, erro });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evento = (nome, ms = 15000) => new Promise((ok, erro) => {
    const t = setTimeout(() => { ouvintes.delete(f); erro(new Error(`sem ${nome}`)); }, ms);
    const f = (d) => { if (d.method === nome) { clearTimeout(t); ouvintes.delete(f); ok(d.params); } };
    ouvintes.add(f);
  });

  await send('Page.enable');
  await send('Runtime.enable');

  const api = {
    send,
    console: consoleMsgs,
    ouvir(f) { ouvintes.add(f); return () => ouvintes.delete(f); },
    async tela(largura, altura, { escala = 1, movel = false, transparente = false } = {}) {
      await send('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: escala, mobile: movel });
      await send('Emulation.setTouchEmulationEnabled', { enabled: movel });
      if (transparente) await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
      else await send('Emulation.setDefaultBackgroundColorOverride', {});
    },
    async ir(url) {
      const carregou = evento('Page.loadEventFired');
      await send('Page.navigate', { url });
      await carregou;
      await api.avaliar('document.fonts.ready.then(() => true)');
      await espera(150);
    },
    async avaliar(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async foto(arquivo, clip) {
      const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 }, captureBeyondViewport: true } : {}) });
      writeFileSync(arquivo, Buffer.from(r.data, 'base64'));
    },
    async pdf(arquivo, opcoes = {}) {
      const r = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, ...opcoes });
      writeFileSync(arquivo, Buffer.from(r.data, 'base64'));
    },
    espera,
    async fechar() {
      try { await send('Browser.close'); } catch { /* já fechou */ }
      ws.close();
      proc.kill();
      await espera(300);
      try { rmSync(perfil, { recursive: true, force: true }); } catch { /* arquivo preso */ }
    },
  };
  return api;
}
