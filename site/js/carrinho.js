// Carrinho: funções puras sobre uma lista de itens. Valores em centavos.
// Item: { chave, produtoId, nome, detalhe, categoria, escolhas, obs, qtd, preco }

import { precoComEscolhas, escolhasValidas, SABOR, GRUPO_ENERGETICO } from './catalogo.js';
import { brl, normalizar } from './util.js';

export const QTD_MAX = 99;

export function chaveItem(produtoId, escolhas = {}, obs = '') {
  const e = Object.keys(escolhas).sort().map((k) => `${k}=${escolhas[k]}`).join('&');
  return `${produtoId}|${e}|${String(obs).trim().toLowerCase()}`;
}

/** Adiciona (ou soma, se já existe igual). Retorna nova lista. */
export function adicionar(itens, { produto, escolhas = {}, obs = '', qtd = 1 }) {
  if (!produto || !produto.disponivel) throw new Error('Produto indisponível');
  if (!escolhasValidas(produto, escolhas)) throw new Error('Escolha as opções');
  // mesma ordem dos grupos do produto (a mensagem sai sempre igual), sabor do energético por último
  const ordenadas = {};
  for (const g of produto.grupos) if (escolhas[g.nome]) ordenadas[g.nome] = escolhas[g.nome];
  if (escolhas[SABOR]) ordenadas[SABOR] = escolhas[SABOR];
  escolhas = ordenadas;
  const chave = chaveItem(produto.id, escolhas, obs);
  const preco = precoComEscolhas(produto, escolhas);
  const existente = itens.find((i) => i.chave === chave);
  if (existente) {
    return itens.map((i) => (i.chave === chave ? { ...i, qtd: Math.min(QTD_MAX, i.qtd + qtd), preco } : i));
  }
  return [...itens, {
    chave,
    produtoId: produto.id,
    nome: produto.nome,
    detalhe: produto.detalhe,
    categoria: produto.categoria,
    escolhas: { ...escolhas },
    obs: String(obs).trim(),
    qtd: Math.max(1, Math.min(QTD_MAX, qtd)),
    preco,
  }];
}

/** Soma delta à quantidade; chegando a 0, remove. */
export function alterarQtd(itens, chave, delta) {
  return itens
    .map((i) => (i.chave === chave ? { ...i, qtd: Math.min(QTD_MAX, i.qtd + delta) } : i))
    .filter((i) => i.qtd > 0);
}

export function remover(itens, chave) {
  return itens.filter((i) => i.chave !== chave);
}

export function subtotal(itens) {
  return itens.reduce((s, i) => s + i.preco * i.qtd, 0);
}

export function contar(itens) {
  return itens.reduce((s, i) => s + i.qtd, 0);
}

/** Quantidade total de um produto no carrinho (somando variantes). */
export function qtdDoProduto(itens, produtoId) {
  return itens.filter((i) => i.produtoId === produtoId).reduce((s, i) => s + i.qtd, 0);
}

/** Escolhas em texto: { Gin: 'Invictus', Energético: 'Red Bull', Sabor do energético: 'Melancia' } → "Invictus, Red Bull Melancia" */
export function textoEscolhas(escolhas = {}) {
  const sabor = escolhas[SABOR];
  return Object.entries(escolhas)
    .filter(([k, v]) => v && k !== SABOR)
    .map(([k, v]) => (sabor && normalizar(k) === GRUPO_ENERGETICO ? `${v} ${sabor}` : v))
    .join(', ');
}

/** Texto do item: "Combo Gordon's Tradicional (Red Bull Melancia)" / "Heineken lata · pack com 8". */
export function descricaoItem(item, categorias = []) {
  const cat = categorias.find((c) => c.id === item.categoria);
  const prefixo = cat?.prefixo ? `${cat.prefixo} ` : '';
  const detalhe = cat?.detalheNaMensagem && item.detalhe ? ` ${item.detalhe}` : '';
  const ops = textoEscolhas(item.escolhas);
  return `${prefixo}${item.nome}${detalhe}${ops ? ` (${ops})` : ''}`;
}

/**
 * Confere o carrinho salvo contra o catálogo atual.
 * Atualiza preços, tira itens esgotados ou que saíram do cardápio e devolve avisos.
 */
export function revalidar(itens, modelo) {
  const avisos = [];
  const novos = [];
  for (const i of itens ?? []) {
    const p = modelo.porId.get(i.produtoId);
    const ops = textoEscolhas(i.escolhas);
    const nome = i.nome + (ops ? ` (${ops})` : '');
    if (!p) {
      avisos.push(`${nome} saiu do cardápio e foi retirado do pedido.`);
      continue;
    }
    if (!p.disponivel || !escolhasValidas(p, i.escolhas)) {
      avisos.push(`${nome} esgotou e foi retirado do pedido.`);
      continue;
    }
    const preco = precoComEscolhas(p, i.escolhas);
    if (preco !== i.preco) {
      const det = p.detalhe ? ` ${p.detalhe}` : '';
      avisos.push(`O preço de ${p.nome}${det} mudou para ${brl(preco)}.`);
    }
    novos.push({ ...i, nome: p.nome, detalhe: p.detalhe, categoria: p.categoria, preco });
  }
  return { itens: novos, avisos };
}

/** Carrinho vindo do localStorage: descarta qualquer coisa malformada. */
export function sanitizar(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.filter((i) => i && typeof i.produtoId === 'string' && Number.isInteger(i.qtd) && i.qtd > 0
    && Number.isInteger(i.preco) && typeof i.chave === 'string').map((i) => ({
    ...i, escolhas: i.escolhas && typeof i.escolhas === 'object' ? i.escolhas : {}, obs: String(i.obs || ''),
  }));
}
