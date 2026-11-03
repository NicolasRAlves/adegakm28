// Gera selo/ícones, imagem de compartilhamento, arte de Status, QR Code e PDF A5.
// Uso:  node ferramentas/gerar-imagens.mjs --url https://seu-dominio.com.br [--final]
// Sem --final, as artes com QR Code saem com a faixa "PRÉVIA" (o link ainda não está no ar).
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { abrirChrome } from './chrome.mjs';

const arg = (n, p) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : p; };
const URL_SITE = arg('url', 'https://adegakm28.netlify.app');
const FINAL = process.argv.includes('--final');
const LINK_CURTO = URL_SITE.replace(/^https?:\/\//, '').replace(/\/$/, '');

const SITE = fileURLToPath(new URL('../site/', import.meta.url));
const F = (n) => pathToFileURL(join(SITE, 'assets/fonts', n)).href;
const QRJS = pathToFileURL(join(SITE, 'assets/js/vendor/qrcode.js')).href;
const ICONES = join(SITE, 'assets/icons');
const IMG = join(SITE, 'assets/img');
const EXTRAS = join(SITE, 'extras');
[ICONES, IMG, EXTRAS].forEach((d) => mkdirSync(d, { recursive: true }));

const CSS_BASE = `
@font-face { font-family: 'Inter'; src: url('${F('jakarta-var.woff2')}') format('woff2'); font-weight: 100 900; }
@font-face { font-family: 'Bebas Neue'; src: url('${F('bebas-neue-400.woff2')}') format('woff2'); }
@font-face { font-family: 'Yellowtail'; src: url('${F('yellowtail-400.woff2')}') format('woff2'); }
* { box-sizing: border-box; margin: 0; }
html, body { background: transparent; }
body { font-family: 'Inter', sans-serif; color: #F5F2EC; -webkit-font-smoothing: antialiased; }
`;

/**
 * Selo circular (sem personagem): "Adega" em script branco + "KM28" bastonado dourado.
 * variante: 'completo' (com o slogan no arco), 'simples' (sem slogan), 'mini' (só KM28, para favicon).
 */
function selo(variante = 'completo') {
  const slogan = variante === 'completo';
  const mini = variante === 'mini';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="ouro" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#EBC47C"/><stop offset=".5" stop-color="#D2A046"/><stop offset="1" stop-color="#A5762A"/>
    </linearGradient>
    <linearGradient id="ouroTxt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F0CD8A"/><stop offset=".55" stop-color="#D6A44B"/><stop offset="1" stop-color="#B07F30"/>
    </linearGradient>
    <radialGradient id="couro" cx="38%" cy="30%" r="80%">
      <stop offset="0" stop-color="#232220"/><stop offset=".6" stop-color="#121211"/><stop offset="1" stop-color="#060606"/>
    </radialGradient>
    <filter id="grao" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="3" seed="7"/>
      <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
    <path id="arco" d="M 86 262 A 170 170 0 0 1 426 262"/>
  </defs>
  <circle cx="256" cy="256" r="250" fill="url(#ouro)"/>
  <circle cx="256" cy="256" r="240" fill="#0A0A0A"/>
  <circle cx="256" cy="256" r="230" fill="url(#couro)"/>
  <circle cx="256" cy="256" r="230" fill="#fff" filter="url(#grao)"/>
  <circle cx="256" cy="256" r="222" fill="none" stroke="url(#ouro)" stroke-width="2.5" opacity=".9"/>
  ${slogan ? `
  <text font-family="Bebas Neue" font-size="36" letter-spacing="7" fill="url(#ouroTxt)">
    <textPath href="#arco" startOffset="50%" text-anchor="middle">O ROLÊ COMEÇA AQUI</textPath>
  </text>
  <g fill="url(#ouroTxt)"><circle cx="256" cy="462" r="4"/><circle cx="226" cy="458" r="3"/><circle cx="286" cy="458" r="3"/></g>` : ''}
  ${mini ? `
  <text x="256" y="330" text-anchor="middle" font-family="Bebas Neue" font-size="230" letter-spacing="2" fill="url(#ouroTxt)">KM28</text>` : `
  <text x="252" y="${slogan ? 268 : 258}" text-anchor="middle" font-family="Yellowtail" font-size="${slogan ? 132 : 150}" fill="#F7F3EA" transform="rotate(-7 256 ${slogan ? 240 : 230})">Adega</text>
  <text x="256" y="${slogan ? 410 : 418}" text-anchor="middle" font-family="Bebas Neue" font-size="${slogan ? 168 : 190}" letter-spacing="4" fill="url(#ouroTxt)">KM28</text>`}
</svg>`;
}

function pagina(corpo, css = '') {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${CSS_BASE}${css}</style>
  <script src="${QRJS}"></script></head><body>${corpo}
  <script>
    for (const el of document.querySelectorAll('[data-qr]')) {
      const q = qrcode(0, 'M'); q.addData(el.dataset.qr); q.make();
      el.innerHTML = q.createSvgTag({ cellSize: 10, margin: 0, scalable: true });
    }
  </script></body></html>`;
}

const PREVIA = FINAL ? '' : `<div class="previa">PRÉVIA · gerar de novo com o link definitivo antes de imprimir/postar</div>`;
const CSS_PREVIA = `.previa { position: absolute; top: 0; left: 0; right: 0; background: #E5484D; color: #fff; font: 700 22px/1 Inter; text-align: center; padding: 14px; z-index: 9; }`;

const tmp = mkdtempSync(join(tmpdir(), 'km28-paginas-'));
const salvarPagina = (nome, html) => { const p = join(tmp, `${nome}.html`); writeFileSync(p, html); return pathToFileURL(p).href; };

const chrome = await abrirChrome();
try {
  // ---- selo e ícones ----
  const pecas = [
    ['selo-512.png', 'completo', 512], ['icon-512.png', 'completo', 512], ['icon-192.png', 'simples', 192],
    ['apple-touch-icon.png', 'simples', 180], ['selo-96.png', 'simples', 96], ['favicon-32.png', 'mini', 32],
  ];
  for (const [nome, variante, tam] of pecas) {
    const fundo = nome === 'apple-touch-icon.png' ? 'background:#0C0C0C;' : '';
    const url = salvarPagina(`selo-${variante}`, pagina(`<div style="width:${tam}px;height:${tam}px;${fundo}">${selo(variante)}</div>`));
    await chrome.tela(tam, tam, { transparente: !fundo });
    await chrome.ir(url);
    await chrome.foto(join(ICONES, nome));
  }
  // maskable: fundo cheio, selo dentro da zona segura (80%)
  {
    const url = salvarPagina('maskable', pagina(`<div style="width:512px;height:512px;background:#0C0C0C;display:grid;place-items:center"><div style="width:400px;height:400px">${selo('simples')}</div></div>`));
    await chrome.tela(512, 512);
    await chrome.ir(url);
    await chrome.foto(join(ICONES, 'icon-maskable-512.png'));
  }

  // ---- Open Graph 1200x630 ----
  {
    const css = `
      .og { width: 1200px; height: 630px; position: relative; overflow: hidden; display: flex; align-items: center; gap: 56px; padding: 0 80px;
        background: radial-gradient(70% 90% at 22% 50%, rgba(210,160,70,.22), transparent 60%), #0C0C0C; }
      .og::after { content: ''; position: absolute; inset: 22px; border: 2px solid rgba(210,160,70,.45); border-radius: 18px; pointer-events: none; }
      .selo { width: 400px; height: 400px; flex: none; filter: drop-shadow(0 20px 40px rgba(0,0,0,.6)); }
      .txt h1 { font: 400 112px/.9 'Bebas Neue'; letter-spacing: 2px; }
      .txt h1 b { color: #D2A046; font-weight: 400; }
      .txt .cta { font: 400 46px/1 'Bebas Neue'; color: #F5B800; letter-spacing: 1px; white-space: nowrap; margin-top: 18px; }
      .txt p { font: 500 26px/1.35 Inter; color: #CFC9BF; margin-top: 18px; max-width: 560px; }
      .txt .end { font: 500 20px/1.3 Inter; color: #A8A39A; margin-top: 26px; }`;
    const url = salvarPagina('og', pagina(`<div class="og"><div class="selo">${selo('completo')}</div>
      <div class="txt"><h1>Adega <b>KM28</b></h1><div class="cta">Cardápio · Peça pelo WhatsApp</div>
      <p>Cerveja trincando e destilados de qualidade. Entrega rápida.</p>
      <p class="end">Rua Frei Amador Arrais, 58 · Jardim São Rafael · SP</p></div></div>`, css));
    await chrome.tela(1200, 630);
    await chrome.ir(url);
    await chrome.foto(join(IMG, 'og.png'));
  }

  // ---- Arte de Status 1080x1920 ----
  {
    const css = `${CSS_PREVIA}
      .st { width: 1080px; height: 1920px; position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 150px 90px 0;
        background: radial-gradient(60% 35% at 50% 20%, rgba(210,160,70,.28), transparent 70%), radial-gradient(50% 30% at 50% 78%, rgba(210,160,70,.12), transparent 70%), #0C0C0C; }
      .st::after { content: ''; position: absolute; inset: 36px; border: 3px solid rgba(210,160,70,.5); border-radius: 30px; }
      .selo { width: 430px; height: 430px; filter: drop-shadow(0 30px 60px rgba(0,0,0,.7)); }
      h1 { font: 400 150px/.88 'Bebas Neue'; letter-spacing: 3px; margin-top: 60px; }
      h1 b { color: #D2A046; font-weight: 400; display: block; }
      .sub { font: 500 42px/1.3 Inter; color: #D9D3C9; margin-top: 34px; }
      .qr { width: 380px; height: 380px; background: #fff; padding: 26px; border-radius: 26px; margin-top: 56px; }
      .qr svg { width: 100%; height: 100%; display: block; }
      .link { font: 400 64px/1 'Bebas Neue'; letter-spacing: 2px; color: #F5B800; margin-top: 34px; }
      .frase { font: 400 58px/1 'Bebas Neue'; letter-spacing: 2px; margin-top: 40px; }
      .legal { position: absolute; bottom: 70px; left: 0; right: 0; font: 500 24px/1.3 Inter; color: #A8A39A; }`;
    const url = salvarPagina('status', pagina(`<div class="st">${PREVIA}<div class="selo">${selo('completo')}</div>
      <h1>Nosso cardápio <b>agora é online</b></h1>
      <p class="sub">Monte seu pedido e envie direto no WhatsApp. Pix, cartão ou dinheiro.</p>
      <div class="qr" data-qr="${URL_SITE}"></div>
      <div class="link">${LINK_CURTO}</div>
      <div class="frase">Aqui tem cerveja gelada!</div>
      <p class="legal">Venda proibida para menores de 18 anos · Beba com moderação</p></div>`, css));
    await chrome.tela(1080, 1920);
    await chrome.ir(url);
    await chrome.foto(join(EXTRAS, 'status-1080x1920.png'));
  }

  // ---- QR Code puro para imprimir ----
  {
    const css = `.q { width: 1200px; height: 1200px; background: #fff; padding: 90px; } .q svg { width: 100%; height: 100%; display: block; }`;
    const url = salvarPagina('qr', pagina(`<div class="q" data-qr="${URL_SITE}"></div>`, css));
    await chrome.tela(1200, 1200);
    await chrome.ir(url);
    await chrome.foto(join(EXTRAS, 'qrcode-cardapio.png'));
  }

  // ---- PDF A5 "Escaneie e peça" ----
  {
    const css = `${CSS_PREVIA}
      @page { size: 148mm 210mm; margin: 0; }
      html, body { background: #0C0C0C; }
      .a5 { width: 148mm; height: 210mm; position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 15mm 12mm 0;
        background: radial-gradient(70% 35% at 50% 18%, rgba(210,160,70,.25), transparent 70%), #0C0C0C; }
      .a5::after { content: ''; position: absolute; inset: 5mm; border: .6mm solid rgba(210,160,70,.6); border-radius: 4mm; }
      .previa { font-size: 9pt; padding: 2mm; }
      .selo { width: 46mm; height: 46mm; }
      h1 { font: 400 40pt/.9 'Bebas Neue'; letter-spacing: 1pt; margin-top: 6mm; }
      h1 b { color: #D2A046; font-weight: 400; }
      .sub { font: 500 11pt/1.35 Inter; color: #D9D3C9; margin-top: 3mm; }
      .qr { width: 62mm; height: 62mm; background: #fff; padding: 4mm; border-radius: 3mm; margin-top: 7mm; }
      .qr svg { width: 100%; height: 100%; display: block; }
      .link { font: 400 20pt/1 'Bebas Neue'; letter-spacing: .5pt; color: #F5B800; margin-top: 4mm; }
      .info { font: 500 9pt/1.45 Inter; color: #CFC9BF; margin-top: 6mm; }
      .info b { color: #D2A046; }
      .legal { position: absolute; bottom: 9mm; left: 10mm; right: 10mm; font: 500 7pt/1.3 Inter; color: #A8A39A; }`;
    const url = salvarPagina('a5', pagina(`<div class="a5">${PREVIA}<div class="selo">${selo('completo')}</div>
      <h1>Escaneie <b>e peça</b></h1>
      <p class="sub">Cardápio completo com preços. Monte o pedido e envie direto no WhatsApp.</p>
      <div class="qr" data-qr="${URL_SITE}"></div>
      <div class="link">${LINK_CURTO}</div>
      <p class="info"><b>WhatsApp</b> (11) 91581-7410 · <b>Instagram</b> @adegakm28<br>Seg a qua 09h às 23h · Qui a dom 11h às 02h<br>Rua Frei Amador Arrais, 58 · Jardim São Rafael</p>
      <p class="legal">Venda proibida para menores de 18 anos · Beba com moderação · Se beber, não dirija.</p></div>`, css));
    await chrome.tela(560, 794);
    await chrome.ir(url);
    await chrome.pdf(join(EXTRAS, 'cardapio-a5-escaneie-e-peca.pdf'));
  }
  if (chrome.console.some((m) => m.startsWith('EXCEÇÃO'))) console.log(chrome.console.join('\n'));
  console.log(`Pronto. Link usado nos QR Codes: ${URL_SITE}${FINAL ? '' : '  (PRÉVIA)'}`);
} finally {
  await chrome.fechar();
  rmSync(tmp, { recursive: true, force: true });
}
