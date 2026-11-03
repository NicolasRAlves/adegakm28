// HTML da home (atalhos e destaques) e da lista de produtos.
// Funções puras: usadas no navegador e no pré-render (ferramentas/prerender.mjs).

import { brl, esc } from './util.js';

/** Assinatura curta de um texto (FNV-1a), para saber se a lista pré-renderizada ainda vale. */
export function assinatura(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export const icone = (id, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} aria-hidden="true"><use href="#${id}"/></svg>`;

export function rotulo(p) {
  return `${p.nome}${p.detalhe ? `, ${p.detalhe}` : ''}`;
}

export function iconeDe(p, cat) {
  if (p.tags.includes('long-neck')) return 'i-longneck';
  return `i-${cat?.icone || 'garrafa'}`;
}

/** Ícone da faixa de aviso da categoria. */
export function iconeNota(cat) {
  if (cat?.icone === 'gin') return 'i-gin';
  if (cat?.icone === 'narguile' || cat?.icone === 'cigarro') return 'i-alerta';
  return 'i-gelo';
}

export function htmlSelos(p) {
  const s = [];
  if (p.destaque === 'novidade') s.push(`<span class="selo selo-novidade">${icone('i-estrela')}Novidade</span>`);
  else if (p.destaque === 'mais-pedido') s.push(`<span class="selo selo-mais-pedido">${icone('i-fogo')}Mais pedido</span>`);
  else if (p.destaque === 'promo' || p.destaque === 'promocao') s.push(`<span class="selo selo-promo">${icone('i-etiqueta')}Promo</span>`);
  if (p.semAlcool) s.push('<span class="selo selo-sem-alcool">Sem álcool</span>');
  if (p.somenteBalcao) s.push('<span class="selo selo-balcao">Só no balcão</span>');
  return s.length ? ` <span class="selos">${s.join('')}</span>` : '';
}

export function htmlPreco(p) {
  const varia = p.precoMin !== p.precoMax;
  return `${varia ? '<span class="apartir">a partir de</span>' : ''}<span class="preco">${brl(p.precoMin)}</span>`;
}

/** Botão + (ou stepper, se o item simples já está no pedido). q = quantidade no carrinho. */
export function htmlAcao(p, q = 0) {
  if (!p.disponivel) return '<span class="selo selo-esgotado">Esgotado</span>';
  const r = esc(rotulo(p));
  if (p.grupos.length || q === 0) {
    return `<button type="button" class="btn-mais${q ? ' no-pedido' : ''}" data-acao="mais" data-id="${p.id}" aria-label="Adicionar ${r}${q ? ` (${q} no pedido)` : ''}">${icone('i-mais')}${q ? `<span class="badge">${q}</span>` : ''}</button>`;
  }
  return `<div class="stepper" role="group" aria-label="Quantidade de ${r}">
    <button type="button" data-acao="menos" data-id="${p.id}" aria-label="Diminuir ${r}">${icone('i-menos')}</button>
    <output aria-live="polite">${q}</output>
    <button type="button" data-acao="mais" data-id="${p.id}" aria-label="Aumentar ${r}">${icone('i-mais')}</button>
  </div>`;
}

function htmlFoto(p, cat, tam = 44) {
  return p.imagem
    ? `<img src="${esc(p.imagem)}" alt="" width="${tam}" height="${tam}" loading="lazy" decoding="async">`
    : icone(iconeDe(p, cat));
}

export function htmlItem(p, cat, comId, q = 0) {
  return `<article class="item${p.disponivel ? '' : ' esgotado'}${p.imagem ? ' com-foto' : ''}"${comId ? ` id="p-${p.id}"` : ''} data-id="${p.id}" data-busca="${esc(p.busca)}"${p.subgrupo ? ` data-subgrupo="${esc(p.subgrupo)}"` : ''}>
    <div class="item-icone">${htmlFoto(p, cat)}</div>
    <div class="item-txt">
      <h3 class="item-nome">${esc(p.nome)}${htmlSelos(p)}</h3>
      <p class="item-sub">${p.detalhe ? `<span class="item-det">${esc(p.detalhe)}</span>` : ''}<span class="item-linha-preco">${htmlPreco(p)}</span></p>
    </div>
    <div class="item-preco-grade" aria-hidden="true">${htmlPreco(p)}</div>
    <div class="item-acao">${htmlAcao(p, q)}</div>
  </article>`;
}

/** Atalhos de categoria com foto (home). */
export function htmlAtalhos(categorias) {
  return categorias.map((c) => `<a class="atalho" href="#${c.id}" data-alvo="${c.id}"${c.alcool !== false ? ' data-alcool="1"' : ''}>
    <span class="atalho-foto">${c.foto ? `<img src="${esc(c.foto)}" alt="" width="180" height="120" loading="lazy" decoding="async">` : icone(`i-${c.icone || 'garrafa'}`)}</span>
    <span class="atalho-nome">${esc(c.nome)}</span>${c.produtos.some((p) => p.destaque === 'novidade') ? '<span class="atalho-novo">Novo</span>' : ''}
    <span class="atalho-qtd">${c.produtos.length} ${c.produtos.length === 1 ? 'item' : 'itens'}</span>
  </a>`).join('');
}

/**
 * Home + lista completa + abas.
 * @param {object[]} categorias  categorias visíveis (com produtos)
 * @param {(id:string)=>number} qtd  quantidade no carrinho por produto
 */
export function htmlCatalogo(categorias, qtd = () => 0) {
  const porId = (id) => categorias.find((c) => c.id === id);
  const itens = (produtos, cat, comId) => produtos.map((p) => htmlItem(p, porId(p.categoria) || cat, comId, qtd(p.id))).join('');
  const secao = (id, nome, produtos, cat) => {
    const nota = cat?.nota
      ? `<p class="secao-nota">${icone(iconeNota(cat))}<span>${esc(cat.nota)}</span></p>` : '';
    // sub-abas (ex.: Essências · Acessórios · Narguilé) quando os produtos têm subgrupo
    const subs = [...new Set(produtos.map((p) => p.subgrupo).filter(Boolean))];
    let corpo;
    let subabas = '';
    if (subs.length > 1) {
      subabas = `<div class="subabas" role="group" aria-label="Filtrar ${esc(nome)}">
        <button type="button" class="subaba" data-subaba="" aria-pressed="true">Todos</button>
        ${subs.map((s) => `<button type="button" class="subaba" data-subaba="${esc(s)}" aria-pressed="false">${esc(s)} <span>${produtos.filter((p) => p.subgrupo === s).length}</span></button>`).join('')}
      </div>`;
      const semGrupo = produtos.filter((p) => !p.subgrupo);
      corpo = subs.map((s) => `<h3 class="subgrupo-titulo" data-subgrupo="${esc(s)}">${esc(s)}</h3>${itens(produtos.filter((p) => p.subgrupo === s), cat, true)}`).join('')
        + itens(semGrupo, cat, true);
    } else {
      corpo = itens(produtos, cat, true);
    }
    const qtdTxt = `${produtos.length} ${produtos.length === 1 ? 'item' : 'itens'}`;
    // capa: banner com foto e o nome da categoria em letras grandes (sem foto: só degradê)
    // --n = "largura" do título em letras; nomes longos quebram em duas linhas
    const longo = nome.length > 14;
    const n = longo ? Math.max(...nome.split(/\s+/).map((w) => w.length), Math.ceil(nome.length / 2)) : nome.length;
    const capa = cat ? `<div class="secao-capa${cat.capa ? '' : ' sem-foto'}${longo ? ' duas-linhas' : ''}" style="--n:${n};--linhas:${longo ? 2 : 1}" aria-hidden="true">
      ${cat.capa ? `<img src="${esc(cat.capa)}" alt="" width="960" height="400" loading="lazy" decoding="async">` : icone(`i-${cat.icone || 'garrafa'}`, 'capa-icone')}
      <span class="capa-titulo">${esc(nome)}</span>
      <span class="capa-qtd">${qtdTxt}</span>
    </div>` : '';
    return `<section class="secao${capa ? ' com-capa' : ''}" id="${id}" aria-labelledby="t-${id}"${cat.alcool !== false ? ' data-alcool="1"' : ''}>
    ${capa}
    <div class="secao-topo">
      <h2 id="t-${id}">${esc(nome)}</h2><span class="qtd">${qtdTxt}</span>
      <button type="button" class="btn-compartilhar" data-acao="compartilhar-cat" data-cat="${id}" data-nome="${esc(nome)}" aria-label="Compartilhar ${esc(nome)}">${icone('i-compartilhar')}</button>
    </div>
    ${nota}
    ${subabas}
    <div class="itens">${corpo}</div>
  </section>`;
  };

  // destaques em carrossel: mais pedidos e promoções
  const todos = categorias.flatMap((c) => c.produtos).filter((p) => p.disponivel);
  const novidades = todos.filter((p) => p.destaque === 'novidade');
  const mais = todos.filter((p) => p.destaque === 'mais-pedido');
  const promo = todos.filter((p) => p.destaque === 'promo' || p.destaque === 'promocao');
  const alcoolDestaque = [...novidades, ...mais, ...promo].some((p) => porId(p.categoria)?.alcool !== false);
  const carrossel = (titulo, ic, lista) => (lista.length ? `
    <div class="carrossel-bloco">
      <h3 class="carrossel-titulo">${icone(ic)}${titulo}</h3>
      <div class="itens carrossel">${itens(lista, null, false)}</div>
    </div>` : '');
  let lista = '';
  if (novidades.length || mais.length || promo.length) {
    lista += `<section class="secao secao-destaques" id="destaques" aria-labelledby="t-destaques"${alcoolDestaque ? ' data-alcool="1"' : ''}>
      <div class="secao-topo"><h2 id="t-destaques">Destaques</h2>
        <button type="button" class="btn-compartilhar" data-acao="compartilhar-cat" data-cat="destaques" data-nome="Destaques" aria-label="Compartilhar Destaques">${icone('i-compartilhar')}</button></div>
      ${carrossel('Novidades', 'i-estrela', novidades)}${carrossel('Mais pedidos', 'i-fogo', mais)}${carrossel('Em promoção', 'i-etiqueta', promo)}
    </section>`;
  }
  lista += categorias.map((c) => secao(c.id, c.nome, c.produtos, c)).join('');

  const abas = [
    ...(novidades.length || mais.length || promo.length ? [{ id: 'destaques', nome: 'Destaques', alcool: alcoolDestaque }] : []),
    ...categorias,
  ].map((c) => `<button type="button" class="aba" data-alvo="${c.id}"${c.alcool !== false ? ' data-alcool="1"' : ''}>${esc(c.nome)}</button>`).join('');
  return { lista, abas, atalhos: htmlAtalhos(categorias) };
}
