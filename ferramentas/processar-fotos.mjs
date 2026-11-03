// Baixa fotos do Wikimedia Commons (licenças livres), recorta, converte para WebP e registra os créditos.
// Uso: node ferramentas/processar-fotos.mjs
// A lista de fotos fica em ferramentas/fotos.json: { "arquivo-destino": { "titulo": "File:...", "w": 320, "h": 320, "foco": "50% 50%" } }
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirChrome } from './chrome.mjs';

const SITE = fileURLToPath(new URL('../site/', import.meta.url));
const LISTA = JSON.parse(readFileSync(new URL('./fotos.json', import.meta.url), 'utf8'));
const UA = 'AdegaKM28-cardapio/1.0 (contato: nrodriguesalves05@gmail.com)';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const limpar = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function info(titulo, largura) {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titulo)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${largura}&format=json`;
  const j = await (await fetch(u, { headers: { 'User-Agent': UA } })).json();
  const p = Object.values(j.query.pages)[0];
  const i = p.imageinfo[0]; const m = i.extmetadata || {};
  return { thumb: i.thumburl, pagina: i.descriptionurl, autor: limpar(m.Artist?.value) || 'autor desconhecido',
    licenca: limpar(m.LicenseShortName?.value), licencaUrl: m.LicenseUrl?.value || '' };
}

async function baixar(url) {
  for (let t = 0; t < 5; t++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok) return Buffer.from(await r.arrayBuffer());
    } catch { /* tenta de novo */ }
    await espera(1500 * (t + 1));
  }
  throw new Error(`Falha ao baixar ${url}`);
}

const chrome = await abrirChrome();
await chrome.tela(800, 600);
await chrome.ir('about:blank');
const creditos = [];
try {
  for (const [destino, f] of Object.entries(LISTA)) {
    // foto por link direto (ex.: loja que autorizou o uso) ou do Wikimedia Commons (pelo título)
    const d = f.url
      ? { thumb: f.url, pagina: f.pagina || f.url, autor: f.autor || 'fornecedor', licenca: f.licenca || 'uso autorizado', licencaUrl: '' }
      : await info(f.titulo, Math.max(f.w * 2, 640));
    if (f.url) f.titulo = f.titulo || destino.split('/').pop();
    const arqFinal = join(SITE, destino);
    if (existsSync(arqFinal) && !process.argv.includes('--refazer')) {
      creditos.push({ arquivo: destino, titulo: f.titulo.replace(/^File:/, ''), autor: d.autor, licenca: d.licenca, licencaUrl: d.licencaUrl, fonte: d.pagina });
      console.log(`· ${destino} já existe`);
      continue;
    }
    const bytes = await baixar(d.thumb);
    const tipo = /\.png(\?|$)/i.test(d.thumb) ? 'png' : /\.webp(\?|$)/i.test(d.thumb) ? 'webp' : 'jpeg';
    const dataUrl = `data:image/${tipo};base64,${bytes.toString('base64')}`;
    // recorte "cover" com ponto de foco, saída WebP
    const webp = await chrome.avaliar(`new Promise((ok, erro) => {
      const img = new Image();
      img.onload = () => {
        const W = ${f.w}, H = ${f.h};
        const [fx, fy] = '${f.foco || '50% 50%'}'.split(' ').map((v) => parseFloat(v) / 100);
        const conter = ${f.modo === 'conter'};
        const esc = conter ? Math.min(W / img.width, H / img.height) * ${f.zoom || 0.94} : Math.max(W / img.width, H / img.height) * ${f.zoom || 1};
        const w = img.width * esc, h = img.height * esc;
        const x = conter ? (W - w) / 2 : Math.min(0, Math.max(W - w, W / 2 - w * fx));
        const y = conter ? (H - h) / 2 : Math.min(0, Math.max(H - h, H / 2 - h * fy));
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
        if (conter) {
          // fundo com a cor do canto da foto (geralmente o fundo branco/cinza do estúdio)
          const t = document.createElement('canvas'); t.width = 1; t.height = 1;
          const tg = t.getContext('2d'); tg.drawImage(img, 2, 2, 1, 1, 0, 0, 1, 1);
          const [r, gg, b] = tg.getImageData(0, 0, 1, 1).data;
          g.fillStyle = 'rgb(' + r + ',' + gg + ',' + b + ')'; g.fillRect(0, 0, W, H);
        }
        g.drawImage(img, x, y, w, h);
        ok(c.toDataURL('image/webp', ${f.q || 0.74}).split(',')[1]);
      };
      img.onerror = () => erro(new Error('imagem inválida'));
      img.src = ${JSON.stringify(dataUrl)};
    })`);
    const arq = join(SITE, destino);
    mkdirSync(dirname(arq), { recursive: true });
    writeFileSync(arq, Buffer.from(webp, 'base64'));
    creditos.push({ arquivo: destino, titulo: f.titulo.replace(/^File:/, ''), autor: d.autor, licenca: d.licenca, licencaUrl: d.licencaUrl, fonte: d.pagina });
    console.log(`✔ ${destino} (${Math.round(Buffer.from(webp, 'base64').length / 1024)} KB) · ${d.licenca} · ${d.autor}`);
    await espera(300);
  }
} finally {
  await chrome.fechar();
}

writeFileSync(join(SITE, 'data/creditos-fotos.json'), JSON.stringify(creditos, null, 1));
const md = ['# Créditos das fotos', '', 'Fotos do Wikimedia Commons, usadas sob licenças livres. As imagens foram recortadas e redimensionadas.', '',
  '| Arquivo | Foto | Autor | Licença |', '|---|---|---|---|',
  ...creditos.map((c) => `| ${c.arquivo} | [${c.titulo}](${c.fonte}) | ${c.autor} | ${c.licencaUrl ? `[${c.licenca}](${c.licencaUrl})` : c.licenca} |`)].join('\n');
writeFileSync(join(SITE, 'CREDITOS-FOTOS.md'), `${md}\n`);
console.log(`\n${creditos.length} fotos processadas. Créditos em site/CREDITOS-FOTOS.md e site/data/creditos-fotos.json`);
