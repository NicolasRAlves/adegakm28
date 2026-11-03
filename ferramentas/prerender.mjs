// Escreve o cardápio de data/catalogo.json direto no index.html.
// Assim a lista aparece na primeira pintura (mesmo antes do JavaScript) e os produtos ficam visíveis para o Google.
// Rode sempre que mudar data/catalogo.json:  node ferramentas/prerender.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { CONFIG } from '../site/data/config.js';
import { montarModelo } from '../site/js/catalogo.js';
import { htmlCatalogo, assinatura } from '../site/js/render.js';

const INDEX = new URL('../site/index.html', import.meta.url);
const cru = JSON.parse(readFileSync(new URL('../site/data/catalogo.json', import.meta.url), 'utf8'));
const modelo = montarModelo(cru, CONFIG);
const { lista, abas, atalhos } = htmlCatalogo(modelo.categorias);

const compactar = (h) => h.replace(/\n\s+/g, '\n');
let html = readFileSync(INDEX, 'utf8');
const trocar = (nome, conteudo) => {
  const re = new RegExp(`(<!--${nome}-->)[\\s\\S]*?(<!--/${nome}-->)`);
  if (!re.test(html)) throw new Error(`Marcador ${nome} não encontrado no index.html`);
  html = html.replace(re, `$1\n${compactar(conteudo)}\n$2`);
};
trocar('CATALOGO-ATALHOS', atalhos);
trocar('CATALOGO-ABAS', abas);
trocar('CATALOGO-LISTA', lista);
// o app compara esta assinatura e não redesenha a lista se nada mudou
html = html.replace(/(<div id="lista"[^>]*?)(?: data-assinatura="[^"]*")?>/, `$1 data-assinatura="${assinatura(lista + abas + atalhos)}">`);
writeFileSync(INDEX, html);
console.log(`index.html atualizado: ${modelo.produtos.length} produtos em ${modelo.categorias.length} categorias.`);
