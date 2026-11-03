// Capa de cada marca de essência: mosaico com fotos dos sabores + nome da marca.
// Uso: node ferramentas/gerar-capas-essencias.mjs  (lê os sabores de site/data/catalogo.json)
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { abrirChrome } from './chrome.mjs';

const SITE = fileURLToPath(new URL('../site/', import.meta.url));
const cat = JSON.parse(readFileSync(join(SITE, 'data/catalogo.json'), 'utf8'));
const F = (n) => pathToFileURL(join(SITE, 'assets/fonts', n)).href;
const essencias = cat.produtos.filter((p) => p.id.startsWith('essencia-'));
const UNICAS = {
  'essencia-ziggy-pink-lemonade': { fotos: ['assets/img/sabores/limao.webp', 'assets/img/sabores/framboesa.webp', 'assets/img/sabores/morango.webp', 'assets/img/sabores/limonada-vermelha.webp'], marca: 'Ziggy', sabor: 'Pink Lemonade' },
};

const tmp = mkdtempSync(join(tmpdir(), 'km28-capas-'));
const c = await abrirChrome();
try {
  await c.tela(320, 320);
  for (const p of essencias) {
    // capa de um sabor só (novidade): foto grande do sabor + marca e nome do sabor
    const unica = UNICAS[p.id];
    let fotos = cat.variantes.filter((v) => v.produto_id === p.id && v.imagem && v.imagem.includes('/sabores/')).slice(0, 4).map((v) => pathToFileURL(join(SITE, v.imagem)).href);
    if (unica) fotos = unica.fotos.map((x) => pathToFileURL(join(SITE, x)).href);
    if (!fotos.length) continue;
    const marca = unica ? unica.marca : p.nome.replace(/^Essência\s+/i, '');
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @font-face { font-family: 'Bebas Neue'; src: url('${F('bebas-neue-400.woff2')}'); }
      @font-face { font-family: 'Jakarta'; src: url('${F('jakarta-var.woff2')}'); font-weight: 200 800; }
      * { margin: 0; box-sizing: border-box; }
      body { width: 320px; height: 320px; background: #0C0C0C; position: relative; overflow: hidden; }
      .m { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; width: 100%; height: 100%; gap: 3px; }
      .m img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .v { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(12,12,12,0) 30%, rgba(12,12,12,.92) 82%); }
      .t { position: absolute; left: 18px; right: 18px; bottom: 16px; color: #F5F2EC; }
      .t small { display: block; font: 800 13px/1 Jakarta; letter-spacing: .14em; text-transform: uppercase; color: #E6BC6A; }
      .t b { display: block; font: 400 64px/.9 'Bebas Neue'; letter-spacing: .03em; margin-top: 4px; }
    </style></head><body>
      <div class="m">${fotos.map((f) => `<img src="${f}">`).join('')}</div>
      <div class="v"${unica ? ` style="background:linear-gradient(180deg, rgba(236,72,140,.45) 0%, rgba(236,72,140,.25) 40%, rgba(12,12,12,.94) 80%)"` : ''}></div>
      <div class="t"><small>${unica ? `Essência ${marca}` : 'Essências'}</small><b${unica ? ' style="font-size:52px;color:#FF8DB8"' : ''}>${unica ? unica.sabor : marca}</b></div>
    </body></html>`;
    const arq = join(tmp, `${p.id}.html`);
    writeFileSync(arq, html);
    await c.ir(pathToFileURL(arq).href);
    const r = await c.send('Page.captureScreenshot', { format: 'webp', quality: 72 });
    const destino = `assets/img/produtos/${p.id}.webp`;
    writeFileSync(join(SITE, destino), Buffer.from(r.data, 'base64'));
    console.log(`✔ ${destino}`);
  }
} finally {
  await c.fechar();
  rmSync(tmp, { recursive: true, force: true });
}
