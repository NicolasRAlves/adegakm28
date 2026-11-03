// Catálogo: lê a planilha (CSV publicado) ou o data/catalogo.json e monta o modelo.

import { parsePreco, parseBool, normalizar } from './util.js';

/**
 * Parser de CSV simples: vírgula como separador, aspas duplas para campos com vírgula,
 * "" dentro de aspas vira ", quebras de linha dentro de aspas são mantidas.
 * Retorna uma matriz de linhas.
 */
export function parseCSV(texto) {
  const linhas = [];
  let linha = [];
  let campo = '';
  let aspas = false;
  const s = String(texto ?? '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (aspas) {
      if (c === '"') {
        if (s[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = '';
    } else campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((v) => v.trim() !== ''));
}

/** CSV -> lista de objetos usando a primeira linha como cabeçalho (normalizado). */
export function csvParaObjetos(texto) {
  const [cab, ...resto] = parseCSV(texto);
  if (!cab) return [];
  const chaves = cab.map((h) => normalizar(h).replace(/\s+/g, '_'));
  return resto.map((l) => Object.fromEntries(chaves.map((k, i) => [k, (l[i] ?? '').trim()])));
}

function listaTags(v) {
  if (Array.isArray(v)) return v.map(normalizar).filter(Boolean);
  return String(v ?? '').split(/[,;]/).map((t) => normalizar(t).replace(/\s+/g, '-')).filter(Boolean);
}

/** Aceita a aba config em colunas (cabeçalho = campos) ou em linhas (campo | valor). */
export function configDeLinhas(linhas) {
  if (!linhas?.length) return {};
  const primeira = linhas[0];
  if ('campo' in primeira && 'valor' in primeira) {
    return Object.fromEntries(linhas.map((l) => [normalizar(l.campo).replace(/\s+/g, '_'), l.valor]));
  }
  return primeira;
}

export function normalizarConfig(c = {}) {
  const pag = String(c.pagamentos ?? 'pix, credito, debito, dinheiro')
    .split(/[,;]/).map(normalizar).filter(Boolean);
  const forc = normalizar(c.aberto_forcado);
  return {
    chave_pix: String(c.chave_pix ?? '').trim(),
    tipo_chave: String(c.tipo_chave ?? '').trim(),
    nome_recebedor: String(c.nome_recebedor ?? '').trim(),
    cidade_pix: String(c.cidade_pix ?? '').trim(),
    banco: String(c.banco ?? '').trim(),
    whatsapp: String(c.whatsapp ?? '').replace(/\D/g, ''),
    taxa_entrega: parsePreco(c.taxa_entrega), // null = a combinar
    pedido_minimo: parsePreco(c.pedido_minimo) || 0,
    aviso_do_dia: String(c.aviso_do_dia ?? '').trim(),
    aberto_forcado: ['aberto', 'fechado'].includes(forc) ? forc : 'auto',
    retirada: parseBool(c.retirada, true),
    pagamentos: pag.length ? pag : ['pix', 'credito', 'debito', 'dinheiro'],
    sabores: lerSabores(c),
    mostrar_tabaco: parseBool(c.mostrar_tabaco, true),
  };
}

/** Grupo de opções onde se escolhe o energético. */
export const GRUPO_ENERGETICO = 'energetico';
/** Chave usada nas escolhas para o sabor do energético. */
export const SABOR = 'Sabor do energético';

const chaveMarca = (nome) => normalizar(nome).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** sabores_red_bull = "Tradicional, Melancia, Tropical" → { red_bull: [...] } */
function lerSabores(c) {
  const s = {};
  for (const [k, v] of Object.entries(c)) {
    if (!k.startsWith('sabores_')) continue;
    const lista = String(v ?? '').split(/[,;]/).map((x) => x.trim()).filter(Boolean);
    if (lista.length) s[k.slice(8)] = lista;
  }
  return s;
}

/**
 * Monta o modelo a partir de dados crus (JSON local ou planilha já convertida em objetos).
 * @param {{produtos:any[], variantes:any[], config:any, bairros:any[]}} cru
 * @param {{categorias:any[]}} site  configuração fixa (data/config.js)
 */
export function montarModelo(cru, site) {
  const config = normalizarConfig(cru.config);
  const variantesPor = new Map();
  for (const v of cru.variantes ?? []) {
    const pid = String(v.produto_id ?? '').trim();
    if (!pid || !String(v.nome ?? '').trim()) continue;
    if (!variantesPor.has(pid)) variantesPor.set(pid, []);
    variantesPor.get(pid).push({
      grupo: String(v.grupo || 'Opção').trim(),
      nome: String(v.nome).trim(),
      preco: parsePreco(v.preco),
      disponivel: parseBool(v.disponivel, true),
      imagem: String(v.imagem ?? '').trim(),
    });
  }

  const produtos = [];
  for (const p of cru.produtos ?? []) {
    const id = String(p.id ?? '').trim();
    const preco = parsePreco(p.preco);
    if (!id || !String(p.nome ?? '').trim()) continue;
    const grupos = [];
    for (const v of variantesPor.get(id) ?? []) {
      let g = grupos.find((x) => x.nome === v.grupo);
      if (!g) grupos.push((g = { nome: v.grupo, opcoes: [] }));
      const op = { nome: v.nome, preco: v.preco, disponivel: v.disponivel };
      if (v.imagem) op.imagem = v.imagem;
      // energético com sabores (Tradicional, Melancia, Tropical...) vindos da aba config
      if (normalizar(v.grupo) === GRUPO_ENERGETICO && config.sabores[chaveMarca(v.nome)]) op.sabores = config.sabores[chaveMarca(v.nome)];
      g.opcoes.push(op);
    }
    const tags = listaTags(p.tags);
    const prod = {
      id,
      categoria: normalizar(p.categoria).replace(/\s+/g, '-'),
      nome: String(p.nome).trim(),
      detalhe: String(p.detalhe ?? '').trim(),
      preco: preco ?? 0,
      disponivel: parseBool(p.disponivel, true) && (preco !== null || grupos.some((g) => g.opcoes.some((o) => o.preco))),
      destaque: normalizar(p.destaque).replace(/\s+/g, '-'),
      ordem: Number(String(p.ordem ?? '').replace(',', '.')) || 0,
      imagem: String(p.imagem ?? '').trim(),
      tags,
      semAlcool: tags.includes('sem-alcool'),
      somenteBalcao: parseBool(p.somente_balcao, false),
      subgrupo: String(p.subgrupo ?? '').trim(), // sub-aba dentro da categoria (ex.: Essências, Acessórios)
      grupos,
    };
    // se todas as opções de um grupo esgotaram, o produto esgota
    if (grupos.some((g) => !g.opcoes.some((o) => o.disponivel))) prod.disponivel = false;
    const faixa = faixaPreco(prod);
    prod.precoMin = faixa.min;
    prod.precoMax = faixa.max;
    prod.busca = normalizar([prod.nome, prod.detalhe, tags.join(' '), grupos.flatMap((g) => g.opcoes.map((o) => o.nome)).join(' ')].join(' '));
    produtos.push(prod);
  }

  // mostrar_tabaco = NÃO: tira do cardápio (e do carrinho, na revalidação) as categorias de tabaco
  // (cigarros) e os produtos com a tag "tabaco" (essências)
  if (!config.mostrar_tabaco) {
    const ocultas = new Set(site.categorias.filter((c) => c.tabaco).map((c) => c.id));
    produtos.splice(0, produtos.length, ...produtos.filter((p) => !ocultas.has(p.categoria) && !p.tags.includes('tabaco')));
  }

  const porCategoria = new Map();
  for (const p of produtos) {
    if (!porCategoria.has(p.categoria)) porCategoria.set(p.categoria, []);
    porCategoria.get(p.categoria).push(p);
  }
  const categorias = [];
  for (const c of site.categorias) {
    const lista = (porCategoria.get(c.id) ?? []).sort((a, b) => a.ordem - b.ordem);
    if (lista.length) categorias.push({ ...c, produtos: lista });
  }
  // categoria digitada na planilha que não está no config.js: aparece no fim com o próprio nome
  for (const [id, lista] of porCategoria) {
    if (!site.categorias.some((c) => c.id === id)) {
      const nome = id.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      categorias.push({ id, nome, icone: 'garrafa', alcool: true, produtos: lista.sort((a, b) => a.ordem - b.ordem) });
    }
  }

  const bairros = (cru.bairros ?? [])
    .map((b) => ({ bairro: String(b.bairro ?? '').trim(), taxa: parsePreco(b.taxa) }))
    .filter((b) => b.bairro);

  return {
    config,
    bairros,
    produtos,
    porId: new Map(produtos.map((p) => [p.id, p])),
    categorias,
  };
}

/** Menor e maior preço possíveis de um produto (para "a partir de"). */
export function faixaPreco(prod) {
  // grupos que mexem no preço; opção sem preço próprio vale o preço do produto
  const valores = prod.grupos
    .filter((g) => g.opcoes.some((o) => o.preco !== null))
    .flatMap((g) => g.opcoes.filter((o) => o.disponivel !== false).map((o) => (o.preco !== null ? o.preco : prod.preco)));
  if (!valores.length) return { min: prod.preco, max: prod.preco };
  return { min: Math.min(...valores), max: Math.max(...valores) };
}

/**
 * Preço unitário com as escolhas feitas. Regra: vale o preço da primeira opção escolhida
 * que tem preço próprio; se nenhuma tiver, vale o preço do produto.
 * @param {object} prod
 * @param {Record<string,string>} escolhas  { grupo: nomeDaOpcao }
 */
export function precoComEscolhas(prod, escolhas = {}) {
  for (const g of prod.grupos) {
    const o = g.opcoes.find((x) => x.nome === escolhas[g.nome]);
    if (o && o.preco !== null) return o.preco;
  }
  return prod.preco;
}

/** Confere se todas as escolhas obrigatórias foram feitas e estão disponíveis. */
export function escolhasValidas(prod, escolhas = {}) {
  return prod.grupos.every((g) => {
    const o = g.opcoes.find((x) => x.nome === escolhas[g.nome]);
    if (!o || !o.disponivel) return false;
    // energético com sabores: o sabor também é obrigatório
    if (o.sabores?.length && !o.sabores.includes(escolhas[SABOR])) return false;
    return true;
  });
}

/** Sabores do energético escolhido (ou [] se não tiver). */
export function saboresDaEscolha(prod, escolhas = {}) {
  for (const g of prod.grupos) {
    const o = g.opcoes.find((x) => x.nome === escolhas[g.nome]);
    if (o?.sabores?.length) return o.sabores;
  }
  return [];
}

function comTimeout(promessa, ms) {
  return Promise.race([
    promessa,
    new Promise((_, rej) => setTimeout(() => rej(new Error('tempo esgotado')), ms)),
  ]);
}

async function baixarTexto(url, fetchFn) {
  const r = await fetchFn(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

/** Lê as abas publicadas da planilha. Lança erro se produtos não vierem. */
export async function lerPlanilha(urls, fetchFn = fetch) {
  const pegar = (u) => (u ? baixarTexto(u, fetchFn).then(csvParaObjetos) : Promise.resolve([]));
  const [produtos, variantes, config, bairros] = await Promise.all([
    pegar(urls.produtos),
    pegar(urls.variantes).catch(() => []),
    pegar(urls.config).catch(() => []),
    pegar(urls.bairros).catch(() => []),
  ]);
  if (!produtos.length || !('id' in produtos[0])) throw new Error('Planilha sem a aba produtos');
  return { produtos, variantes, config: configDeLinhas(config), bairros };
}

export async function lerLocal(fetchFn = fetch, url = 'data/catalogo.json') {
  // sem opções de cache: aproveita o <link rel="preload"> do index.html
  const r = await fetchFn(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/**
 * Carrega o catálogo: planilha (se configurada) com tempo-limite; se falhar, catálogo local.
 * @returns {Promise<{cru:object, origem:'planilha'|'local'}>}
 */
export async function carregarCatalogo(site, fetchFn = fetch) {
  const temPlanilha = site.planilha && site.planilha.produtos;
  if (temPlanilha) {
    try {
      const cru = await comTimeout(lerPlanilha(site.planilha, fetchFn), site.planilhaTimeoutMs || 5000);
      return { cru, origem: 'planilha' };
    } catch (e) {
      console.warn('Planilha indisponível, usando catálogo local:', e.message);
    }
  }
  return { cru: await lerLocal(fetchFn), origem: 'local' };
}
