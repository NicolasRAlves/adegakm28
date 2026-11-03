// Servidor local simples para testar o site: node ferramentas/servidor.mjs [porta]
// Abre em http://localhost:8080 e na rede local (para testar no celular).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../site/', import.meta.url));
const PORTA = Number(process.argv[2]) || 8080;
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.pdf': 'application/pdf', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.md': 'text/plain; charset=utf-8',
};

export function iniciarServidor(porta = PORTA) {
  const srv = createServer(async (req, res) => {
    try {
      let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (caminho.endsWith('/')) caminho += 'index.html';
      const arq = normalize(join(RAIZ, caminho));
      if (!arq.startsWith(normalize(RAIZ))) { res.writeHead(403).end(); return; }
      let alvo = arq;
      let codigo = 200;
      try { if (!(await stat(alvo)).isFile()) throw new Error(); } catch { alvo = join(RAIZ, '404.html'); codigo = 404; }
      let corpo = await readFile(alvo);
      const tipo = TIPOS[extname(alvo)] || 'application/octet-stream';
      const cab = { 'Content-Type': tipo, 'Cache-Control': 'no-cache' };
      // compacta texto, como Netlify/Vercel fazem
      if (/text|javascript|json|svg|manifest/.test(tipo) && /gzip/.test(req.headers['accept-encoding'] || '')) {
        corpo = gzipSync(corpo);
        cab['Content-Encoding'] = 'gzip';
      }
      res.writeHead(codigo, cab);
      res.end(corpo);
    } catch (e) {
      res.writeHead(500).end(String(e));
    }
  });
  return new Promise((ok) => srv.listen(porta, '0.0.0.0', () => ok(srv)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  await iniciarServidor();
  console.log(`Cardápio rodando em http://localhost:${PORTA}`);
  for (const lista of Object.values(networkInterfaces())) {
    for (const n of lista || []) if (n.family === 'IPv4' && !n.internal) console.log(`No celular (mesmo Wi-Fi): http://${n.address}:${PORTA}`);
  }
}
