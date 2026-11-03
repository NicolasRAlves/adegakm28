// Adega KM28 · inicialização, telas e eventos.

import { CONFIG } from '../data/config.js';
import { brl, esc, normalizar, parsePreco, store } from './util.js';
import { carregarCatalogo, montarModelo, precoComEscolhas, escolhasValidas, saboresDaEscolha, SABOR } from './catalogo.js';
import {
  adicionar, alterarQtd, remover, subtotal, contar, qtdDoProduto, revalidar, sanitizar, chaveItem, descricaoItem,
} from './carrinho.js';
import { statusAgora } from './horario.js';
import { gerarNumeroPedido, montarMensagem, linkWhatsApp } from './whatsapp.js';
import {
  htmlCheckout, lerFormulario, validar, mostrarErros, calcularTaxa, buscarCep, buscarEndereco, dadosSalvos, salvarDados, esquecerDados,
} from './checkout.js';
import { gerarBrCode, normalizarChave } from './pix.js';
import { icone, iconeDe, iconeNota, htmlCatalogo, htmlAcao, assinatura } from './render.js';

const K = { idade: 'km28.idade', carrinho: 'km28.carrinho', modo: 'km28.modo', ultimo: 'km28.ultimo', cache: 'km28.catalogo' };
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const desktop = matchMedia('(min-width: 1024px)');

const S = {
  modelo: null,
  origem: '',
  itens: sanitizar(store.get(K.carrinho, [])),
  modo: store.get(K.modo, 'lista') === 'grade' ? 'grade' : 'lista',
  idade: store.get(K.idade, null),
  avisos: [],
  confirmarLimpar: false,
  produto: null,
  escolhas: {},
  qtd: 1,
  instalar: null,
};

/* ---------------- Utilidades de tela ---------------- */

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('ver');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('ver'), 2200);
}

function vibrar() {
  try { navigator.vibrate?.(12); } catch { /* sem vibração */ }
}

function abrir(dlg) {
  if (!dlg.open) dlg.showModal();
}
function fechar(dlg) {
  if (dlg.open) dlg.close();
}

async function copiar(texto, ok = 'Copiado!', campo = null) {
  try {
    await navigator.clipboard.writeText(texto);
    toast(ok);
    return;
  } catch { /* cai no plano B */ }
  if (campo) {
    campo.focus();
    campo.select?.();
    try {
      if (document.execCommand('copy')) { toast(ok); return; }
    } catch { /* nada */ }
    toast('Texto selecionado: toque e segure para copiar');
  } else {
    window.prompt('Copie o texto:', texto);
  }
}

async function compartilhar(titulo, hash) {
  const url = `${location.origin}${location.pathname}${hash || ''}`;
  if (navigator.share) {
    try { await navigator.share({ title: titulo, text: `${titulo} · Adega KM28`, url }); } catch { /* cancelou */ }
    return;
  }
  copiar(url, 'Link copiado!');
}

function cfg() {
  return S.modelo?.config ?? { pagamentos: ['pix', 'credito', 'debito', 'dinheiro'], retirada: true, pedido_minimo: 0, taxa_entrega: null, whatsapp: CONFIG.whatsapp };
}
function numeroWhatsApp() {
  return cfg().whatsapp || CONFIG.whatsapp;
}

/* ---------------- Catálogo visível ---------------- */

function categoriasVisiveis() {
  if (!S.modelo) return [];
  return S.modelo.categorias.filter((c) => S.idade !== 'menor' || c.alcool === false);
}
function categoriaDe(id) {
  return S.modelo?.categorias.find((c) => c.id === id);
}
function temAlcool(itens) {
  return itens.some((i) => {
    const c = categoriaDe(i.categoria);
    const p = S.modelo?.porId.get(i.produtoId);
    return (c ? c.alcool !== false : true) && !p?.semAlcool;
  });
}

/* ---------------- Lista de produtos ---------------- */

function renderLista() {
  const cats = categoriasVisiveis();
  const lista = $('#lista');
  lista.className = `lista modo-${S.modo}`;
  // a lista que veio pronta no HTML ainda vale? então só ajusta os botões
  const base = htmlCatalogo(cats);
  const ass = assinatura(base.lista + base.abas + base.atalhos);
  if (lista.dataset.assinatura === ass) {
    atualizarAcoes();
  } else {
    const { lista: html, abas, atalhos } = htmlCatalogo(cats, (id) => qtdDoProduto(S.itens, id));
    lista.innerHTML = html;
    lista.dataset.assinatura = ass;
    $('#abas').innerHTML = abas;
    $('#atalhos').innerHTML = atalhos;
  }
  observarSecoes();
  filtrar();
}

/** Atualiza só os botões +/stepper (rápido, sem redesenhar a lista). */
function atualizarAcoes() {
  for (const el of $$('.item[data-id]')) {
    const p = S.modelo.porId.get(el.dataset.id);
    if (!p) continue;
    const acao = el.querySelector('.item-acao');
    const foco = acao.contains(document.activeElement) ? document.activeElement.dataset.acao : null;
    acao.innerHTML = htmlAcao(p, qtdDoProduto(S.itens, p.id));
    if (foco) (acao.querySelector(`[data-acao="${foco}"]`) || acao.querySelector('button'))?.focus();
  }
}

/* ---------------- Abas ---------------- */

let observador;
function observarSecoes() {
  observador?.disconnect();
  const abas = $('#abas');
  const marcar = (id) => {
    for (const a of $$('.aba', abas)) {
      const ativo = a.dataset.alvo === id;
      a.setAttribute('aria-current', ativo ? 'true' : 'false');
      if (ativo) abas.scrollTo({ left: a.offsetLeft - 16, behavior: 'smooth' });
    }
  };
  observador = new IntersectionObserver((entradas) => {
    const vis = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (vis[0]) marcar(vis[0].target.id);
  }, { rootMargin: '-56px 0px -70% 0px' });
  $$('.secao').forEach((s) => observador.observe(s));
  const primeira = $('.aba', abas);
  if (primeira) marcar(primeira.dataset.alvo);
}

/* ---------------- Sub-abas (ex.: Essências · Acessórios · Narguilé) ---------------- */

function escolherSubaba(botao) {
  const sec = botao.closest('.secao');
  const alvo = botao.dataset.subaba;
  for (const b of $$('.subaba', sec)) b.setAttribute('aria-pressed', String(b === botao));
  for (const el of $$('[data-subgrupo]', sec)) el.classList.toggle('fora-subaba', Boolean(alvo) && el.dataset.subgrupo !== alvo);
  // mantém o topo da seção à vista ao trocar de sub-aba
  const topo = sec.getBoundingClientRect().top;
  if (topo < 0) sec.scrollIntoView({ block: 'start' });
}

function limparSubabas() {
  for (const sec of $$('.secao')) {
    const todos = $('.subaba[data-subaba=""]', sec);
    if (todos && todos.getAttribute('aria-pressed') !== 'true') escolherSubaba(todos);
  }
}

/* ---------------- Busca ---------------- */

function filtrar() {
  const termo = normalizar($('#busca').value);
  if (termo) limparSubabas();
  let algum = false;
  for (const sec of $$('.secao')) {
    if (termo && sec.id === 'destaques') { sec.hidden = true; continue; }
    let vis = 0;
    for (const it of $$('.item', sec)) {
      const ok = !termo || termo.split(/\s+/).every((t) => it.dataset.busca.includes(t));
      it.hidden = !ok;
      if (ok) vis++;
    }
    // na busca, os títulos e as sub-abas somem (só os itens encontrados aparecem)
    for (const el of $$('.subgrupo-titulo, .subabas', sec)) el.hidden = Boolean(termo);
    sec.hidden = vis === 0;
    if (vis) algum = true;
  }
  $('#vazio-busca').hidden = algum || !S.modelo;
  $('.abas').hidden = Boolean(termo);
  $('#atalhos').hidden = Boolean(termo);
}

/* ---------------- Carrinho ---------------- */

function salvarCarrinho() {
  store.set(K.carrinho, S.itens);
}

function mudouCarrinho({ pop = false } = {}) {
  S.confirmarLimpar = false;
  salvarCarrinho();
  atualizarAcoes();
  renderCarrinho();
  if (pop) {
    vibrar();
    const b = $('#abrir-carrinho');
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }
}

function addSimples(p) {
  try {
    S.itens = adicionar(S.itens, { produto: p });
    S.avisos = [];
    mudouCarrinho({ pop: true });
    if (desktop.matches) toast(`${p.nome} adicionado`);
  } catch (e) {
    toast(e.message);
  }
}

function menosProduto(id) {
  const base = chaveItem(id, {}, '');
  const linha = S.itens.find((i) => i.chave === base) || [...S.itens].reverse().find((i) => i.produtoId === id);
  if (!linha) return;
  S.itens = alterarQtd(S.itens, linha.chave, -1);
  mudouCarrinho();
}

function htmlCarrinhoItens() {
  if (!S.itens.length) {
    return `<div class="carrinho-vazio">${icone('i-sacola')}<p>Seu pedido está vazio.</p><p>Toque no <b>+</b> dos itens para adicionar.</p></div>`;
  }
  const cats = S.modelo?.categorias ?? CONFIG.categorias;
  return `<ul class="c-itens">${S.itens.map((i) => {
    const p = S.modelo?.porId.get(i.produtoId);
    const nome = esc(descricaoItem(i, cats));
    const det = !categoriaDe(i.categoria)?.detalheNaMensagem && i.detalhe && !Object.keys(i.escolhas).length ? i.detalhe : '';
    return `<li class="c-item">
      <div>
        <p class="c-nome">${nome}</p>
        ${det ? `<p class="c-det">${esc(det)}</p>` : ''}
        ${i.obs ? `<p class="c-obs">obs: ${esc(i.obs)}</p>` : ''}
        ${p?.somenteBalcao ? '<span class="selo selo-balcao">Só no balcão</span>' : ''}
      </div>
      <div class="c-total"><span class="preco">${brl(i.preco * i.qtd)}</span>${i.qtd > 1 ? `<p class="c-unit">${brl(i.preco)} cada</p>` : ''}</div>
      <div class="c-acoes">
        <div class="stepper claro" role="group" aria-label="Quantidade de ${nome}">
          <button type="button" data-acao="c-menos" data-chave="${esc(i.chave)}" aria-label="Diminuir ${nome}">${icone('i-menos')}</button>
          <output>${i.qtd}</output>
          <button type="button" data-acao="c-mais" data-chave="${esc(i.chave)}" aria-label="Aumentar ${nome}">${icone('i-mais')}</button>
        </div>
        <button type="button" class="btn-rem" data-acao="c-rem" data-chave="${esc(i.chave)}" aria-label="Remover ${nome}">${icone('i-lixo')}</button>
      </div>
    </li>`;
  }).join('')}</ul>`;
}

function htmlAvisos() {
  if (!S.avisos.length) return '';
  return `<div class="c-avisos" role="status">${S.avisos.map((a) => `<p class="nota erro">${icone('i-alerta')}<span>${esc(a)}</span></p>`).join('')}</div>`;
}

function htmlCarrinhoPe() {
  if (!S.itens.length) return '';
  const sub = subtotal(S.itens);
  const min = cfg().pedido_minimo || 0;
  const falta = min && sub < min ? min - sub : 0;
  const limpar = S.confirmarLimpar
    ? `<div class="c-limpar" role="group" aria-label="Confirmar limpeza"><span>Tirar todos os itens?</span>
        <button type="button" class="btn-perigo" data-acao="limpar-sim">Sim, limpar</button>
        <button type="button" class="btn-sec" data-acao="limpar-nao">Cancelar</button></div>`
    : '<div class="c-limpar"><button type="button" class="link" data-acao="limpar">Limpar carrinho</button></div>';
  return `
    <div class="c-subtotal"><span>Subtotal</span><span class="preco">${brl(sub)}</span></div>
    ${falta ? `<p class="nota erro">${icone('i-alerta')}<span>Faltam ${brl(falta)} para o pedido mínimo de ${brl(min)}.</span></p>` : ''}
    <button type="button" class="btn-pri btn-largo" data-acao="finalizar"${falta ? ' aria-disabled="true"' : ''}>Finalizar pedido ${icone('i-seta')}</button>
    ${limpar}`;
}

function renderCarrinho() {
  const n = contar(S.itens);
  const sub = subtotal(S.itens);
  // barra (celular)
  const barra = $('#barra-carrinho');
  barra.hidden = n === 0;
  document.body.classList.toggle('com-barra', n > 0);
  $('#barra-qtd').textContent = n;
  $('#barra-txt').textContent = `${n} ${n === 1 ? 'item' : 'itens'} · ${brl(sub)}`;
  $('#abrir-carrinho').setAttribute('aria-label', `Ver pedido: ${n} ${n === 1 ? 'item' : 'itens'}, ${brl(sub)}`);

  const sub2 = n ? `<p class="sub">${n} ${n === 1 ? 'item' : 'itens'}</p>` : '';
  // lateral (desktop)
  $('#carrinho-lateral').innerHTML = `
    <div class="lateral-topo"><div><h2>Seu pedido</h2>${sub2}</div></div>
    <div class="lateral-meio">${htmlAvisos()}${htmlCarrinhoItens()}</div>
    ${n ? `<div class="lateral-pe">${htmlCarrinhoPe()}</div>` : ''}`;
  // gaveta (celular)
  $('#carrinho-gaveta').innerHTML = `
    <header class="sheet-topo"><div><h2>Seu pedido</h2>${sub2}</div>
      <div class="acoes-topo"><button type="button" class="btn-fechar" data-acao="fechar" aria-label="Fechar">${icone('i-fechar')}</button></div></header>
    <div class="sheet-meio">${htmlAvisos()}${htmlCarrinhoItens()}</div>
    ${n ? `<footer class="sheet-pe">${htmlCarrinhoPe()}</footer>` : ''}`;

  // repetir último pedido
  const ult = store.get(K.ultimo, null);
  const rep = $('#repetir-ultimo');
  rep.hidden = !(ult?.itens?.length && n === 0);
  if (!rep.hidden) $('#repetir-txt').textContent = `Repetir último pedido · ${contar(ult.itens)} ${contar(ult.itens) === 1 ? 'item' : 'itens'}`;
}

function repetirPedido(itens) {
  if (!S.modelo) return;
  const r = revalidar(sanitizar(itens), S.modelo);
  const visiveis = new Set(categoriasVisiveis().map((c) => c.id));
  S.itens = r.itens.filter((i) => visiveis.has(i.categoria));
  S.avisos = r.avisos;
  mudouCarrinho({ pop: true });
  if (!desktop.matches) abrir($('#dlg-carrinho'));
  else toast('Itens de volta no pedido');
}

/* ---------------- Produto com opções (bottom sheet) ---------------- */

function htmlGrupo(g, gi, p, chave = g.nome, extra = '') {
  return `
        <fieldset class="grupo${extra}" id="grupo-${gi}" data-grupo="${esc(chave)}">
          <legend>${esc(g.titulo || g.nome)} <span class="obrig">obrigatório</span></legend>
          <div class="opcoes${g.opcoes.some((o) => o.imagem) ? ' com-fotos' : ''}">
            ${g.opcoes.map((o, oi) => {
              const id = `op-${gi}-${oi}`;
              const precoOp = o.preco != null && p.precoMin !== p.precoMax ? `<span class="op-preco">${brl(o.preco)}</span>` : '';
              const sab = o.sabores?.length ? `<span class="op-sub">${o.sabores.length} sabores</span>` : '';
              const foto = o.imagem ? `<img src="${esc(o.imagem)}" alt="" width="96" height="96" loading="lazy" decoding="async">` : '';
              return `<div class="opcao"><input type="radio" name="g${gi}" id="${id}" value="${esc(o.nome)}"${o.disponivel === false ? ' disabled' : ''}${S.escolhas[chave] === o.nome ? ' checked' : ''}>
                <label for="${id}">${foto}<span>${esc(o.nome)}${sab}</span>${o.disponivel === false ? '<span class="op-esg">esgotado</span>' : precoOp}</label></div>`;
            }).join('')}
          </div>
        </fieldset>`;
}

/** Mostra (ou esconde) a escolha de sabor do energético escolhido. */
function renderSabores() {
  const p = S.produto;
  const box = $('#sabores-box');
  if (!p || !box) return;
  const sabores = saboresDaEscolha(p, S.escolhas);
  if (!sabores.length) {
    delete S.escolhas[SABOR];
    box.innerHTML = '';
    return;
  }
  if (!sabores.includes(S.escolhas[SABOR])) S.escolhas[SABOR] = sabores[0];
  const marca = p.grupos.map((g) => S.escolhas[g.nome]).find((n) => p.grupos.some((g) => g.opcoes.some((o) => o.nome === n && o.sabores?.length)));
  const g = { nome: SABOR, titulo: `Sabor do ${marca}`, opcoes: sabores.map((s) => ({ nome: s, preco: null, disponivel: true })) };
  box.innerHTML = htmlGrupo(g, 'sabor', p, SABOR, ' grupo-sabores');
}

function abrirProduto(p) {
  S.produto = p;
  S.escolhas = {};
  S.qtd = 1;
  // se o grupo só tem uma opção disponível, já vem marcada
  for (const g of p.grupos) {
    const disp = g.opcoes.filter((o) => o.disponivel);
    if (disp.length === 1) S.escolhas[g.nome] = disp[0].nome;
  }
  const cat = categoriaDe(p.categoria);
  const form = $('#form-produto');
  const foto = p.imagem
    ? `<img src="${esc(p.imagem)}" alt="" width="72" height="72">`
    : icone(iconeDe(p, cat));
  form.innerHTML = `
    <header class="sheet-topo">
      <div class="item-icone sheet-foto">${foto}</div>
      <div class="sheet-titulo">
        <h2 id="produto-titulo">${esc(cat?.prefixo ? `${cat.prefixo} ${p.nome}` : p.nome)}</h2>
        ${p.detalhe ? `<p class="sub">${esc(p.detalhe)}</p>` : ''}
        <p class="sheet-preco">${p.precoMin !== p.precoMax ? '<span class="apartir">a partir de</span> ' : ''}<span class="preco">${brl(p.precoMin)}</span></p>
      </div>
      <div class="acoes-topo">
        <button type="button" class="btn-fechar" data-acao="compartilhar-prod" aria-label="Compartilhar ${esc(p.nome)}">${icone('i-compartilhar')}</button>
        <button type="button" class="btn-fechar" data-acao="fechar" aria-label="Fechar">${icone('i-fechar')}</button>
      </div>
    </header>
    <div class="sheet-meio">
      ${cat?.nota ? `<p class="nota">${icone(iconeNota(cat))}<span>${esc(cat.nota)}</span></p>` : ''}
      ${p.somenteBalcao ? `<p class="nota">${icone('i-pino')}<span><b>Só no balcão:</b> este item não vai na entrega. Escolha "Retirada no balcão" ao finalizar.</span></p>` : ''}
      <div style="height:12px"></div>
      ${p.grupos.map((g, gi) => htmlGrupo(g, gi, p) + (g.opcoes.some((o) => o.sabores?.length) ? '<div id="sabores-box"></div>' : '')).join('')}
      <div class="qtd-linha">
        <span>Quantidade</span>
        <div class="stepper claro" role="group" aria-label="Quantidade">
          <button type="button" data-acao="s-menos" aria-label="Diminuir quantidade">${icone('i-menos')}</button>
          <output id="s-qtd" aria-live="polite">1</output>
          <button type="button" data-acao="s-mais" aria-label="Aumentar quantidade">${icone('i-mais')}</button>
        </div>
      </div>
      <div class="campo">
        <label for="s-obs">Observação <span class="opc">(opcional)</span></label>
        <input id="s-obs" name="obs" maxlength="120" placeholder="Ex.: bem gelada">
      </div>
    </div>
    <footer class="sheet-pe">
      <p class="msg-grupo" id="s-erro" role="alert"></p>
      <button type="submit" class="btn-pri btn-largo" id="s-add"></button>
    </footer>`;
  renderSabores();
  atualizarBotaoSheet();
  const dlg = $('#dlg-produto');
  abrir(dlg);
  history.replaceState(null, '', `#p-${p.id}`);
}

function atualizarBotaoSheet() {
  const p = S.produto;
  const b = $('#s-add');
  if (!p || !b) return;
  $('#s-qtd').textContent = S.qtd;
  const falta = p.grupos.find((g) => !S.escolhas[g.nome]);
  b.textContent = falta && p.precoMin !== p.precoMax
    ? `Escolha: ${falta.nome}`
    : `Adicionar · ${brl(precoComEscolhas(p, S.escolhas) * S.qtd)}`;
}

function enviarSheet() {
  const p = S.produto;
  const form = $('#form-produto');
  $$('.grupo', form).forEach((g) => g.classList.remove('erro'));
  if (!escolhasValidas(p, S.escolhas)) {
    const gi = p.grupos.findIndex((g) => !S.escolhas[g.nome]);
    const fs = gi >= 0 ? $(`#grupo-${gi}`, form) : $('#grupo-sabor', form);
    fs?.classList.add('erro');
    $('#s-erro').textContent = gi >= 0 ? `Escolha uma opção em "${p.grupos[gi].nome}".` : 'Escolha o sabor do energético.';
    fs?.querySelector('input:not(:disabled)')?.focus();
    return;
  }
  try {
    S.itens = adicionar(S.itens, { produto: p, escolhas: S.escolhas, obs: $('#s-obs').value, qtd: S.qtd });
    S.avisos = [];
    fechar($('#dlg-produto'));
    mudouCarrinho({ pop: true });
    toast(`${p.nome} adicionado`);
  } catch (e) {
    $('#s-erro').textContent = e.message;
  }
}

/* ---------------- Finalização ---------------- */

function contextoValidacao(d) {
  const c = cfg();
  const sub = subtotal(S.itens);
  const { taxa } = calcularTaxa(d, c, S.modelo.bairros);
  const itensBalcao = S.itens.filter((i) => S.modelo.porId.get(i.produtoId)?.somenteBalcao).map((i) => i.nome);
  return {
    subtotal: sub,
    total: sub + (taxa || 0),
    taxa,
    temAlcool: temAlcool(S.itens),
    itensBalcao: [...new Set(itensBalcao)],
    pedidoMinimo: c.pedido_minimo,
    bairros: S.modelo.bairros,
  };
}

function atualizarResumo(form) {
  const d = lerFormulario(form);
  const c = cfg();
  const sub = subtotal(S.itens);
  const t = calcularTaxa(d, c, S.modelo.bairros);
  const entrega = d.recebimento === 'entrega';
  const linhas = S.itens.map((i) => `<div class="r-item"><span>${i.qtd}x ${esc(descricaoItem(i, S.modelo.categorias))}</span><span class="num">${brl(i.preco * i.qtd)}</span></div>`).join('');
  const taxaTxt = !entrega ? '' : `<div class="r-item"><span>Entrega${t.bairroTaxa ? ` (${esc(t.bairroTaxa)})` : ''}</span><span class="num">${t.taxa === null ? 'a combinar' : t.taxa ? brl(t.taxa) : 'grátis'}</span></div>`;
  $('#ck-resumo', form).innerHTML = `${linhas}
    <div class="r-item" style="margin-top:6px"><span>Subtotal</span><span class="num">${brl(sub)}</span></div>
    ${taxaTxt}
    <div class="r-total"><span>Total</span><span class="preco">${brl(sub + (entrega && t.taxa ? t.taxa : 0))}${entrega && t.taxa === null ? '<small style="font:600 12px var(--fonte);color:var(--cinza)"> + entrega</small>' : ''}</span></div>`;

  $('#ck-endereco', form).hidden = !entrega;
  $('#ck-retirada-info', form).hidden = entrega;
  // taxa do bairro, logo abaixo do endereço
  const info = $('#ck-taxa-info', form);
  info.hidden = !entrega || !d.bairro;
  if (!info.hidden) {
    info.innerHTML = t.taxa === null
      ? `${icone('i-moto')}<span>Entrega no <b>${esc(d.bairro)}</b>: taxa combinada no WhatsApp.</span>`
      : `${icone('i-moto')}<span>Entrega no <b>${esc(d.bairro)}</b>: <b class="num">${t.taxa ? brl(t.taxa) : 'grátis'}</b></span>`;
  }
  $('#ck-pix-info', form).hidden = d.pagamento !== 'pix';
  $('#ck-troco', form).hidden = d.pagamento !== 'dinheiro';
  $('#ck-troco-valor', form).disabled = d.semTroco;
}

function abrirCheckout() {
  if (!S.itens.length || !S.modelo) return;
  const c = cfg();
  const sub = subtotal(S.itens);
  if (c.pedido_minimo && sub < c.pedido_minimo) {
    toast(`Faltam ${brl(c.pedido_minimo - sub)} para o pedido mínimo`);
    return;
  }
  fechar($('#dlg-carrinho'));
  const form = $('#form-checkout');
  form.innerHTML = htmlCheckout({ config: c, bairros: S.modelo.bairros, temAlcool: temAlcool(S.itens), salvos: dadosSalvos() });
  atualizarResumo(form);
  abrir($('#dlg-checkout'));
  $('.tela-meio', form).scrollTop = 0;
}

/** Rua e bairro: travados (vêm do CEP) ou liberados para digitar. */
/** Número, complemento e referência: liberados depois que o CEP (ou a rua) é encontrado. */
function liberarDetalhes(form) {
  for (const id of ['#ck-numero', '#ck-complemento', '#ck-referencia']) {
    const el = $(id, form);
    el.disabled = false;
    if (id === '#ck-numero') el.placeholder = '';
  }
}

function travarEndereco(form, travar) {
  for (const id of ['#ck-rua', '#ck-bairro']) {
    const el = $(id, form);
    el.readOnly = travar;
    el.placeholder = travar ? (id === '#ck-rua' ? 'preenchida pelo CEP' : 'preenchido pelo CEP') : (id === '#ck-rua' ? 'Digite o nome da rua' : 'Digite o bairro');
  }
  form.querySelector('.endereco-auto').classList.toggle('livre', !travar);
}

/** Preenche rua, bairro e CEP a partir do ViaCEP e vai para o número. */
function preencherEndereco(form, { rua, bairro, cep }, focarNumero) {
  if (rua) $('#ck-rua', form).value = rua;
  if (cep) $('#ck-cep', form).value = cep;
  if (bairro) $('#ck-bairro', form).value = bairro;
  for (const c of ['cep', 'rua', 'bairro']) {
    $(`[name="${c}"]`, form).removeAttribute('aria-invalid');
    $(`#erro-${c}`, form).textContent = '';
  }
  $('#ck-rua-sug', form).hidden = true;
  $('#ck-rua-status', form).textContent = '';
  // sem rua (CEP geral da cidade): libera para digitar
  travarEndereco(form, Boolean(rua && bairro));
  liberarDetalhes(form);
  atualizarResumo(form);
  if (rua) {
    $('#ck-numero', form).focus();
    if (!focarNumero) $('#ck-numero', form).scrollIntoView({ block: 'center' });
  } else {
    $('#ck-rua', form).focus();
  }
}

let timerRua;
let buscaRuaAtual = '';
/** Sugestões de rua enquanto digita (ViaCEP, cidade da adega). */
function sugerirRuas(form, texto) {
  clearTimeout(timerRua);
  const lista = $('#ck-rua-sug', form);
  const st = $('#ck-rua-status', form);
  if ($('#ck-rua', form).readOnly || texto.trim().length < 4) { lista.hidden = true; return; }
  timerRua = setTimeout(async () => {
    buscaRuaAtual = texto;
    st.textContent = 'Procurando a rua…';
    const r = await buscarEndereco(texto, CONFIG.endereco);
    if (buscaRuaAtual !== texto || $('#ck-rua', form).value !== texto) return;
    if (!r.length) {
      lista.hidden = true;
      st.textContent = 'Não achamos essa rua em São Paulo. Pode continuar digitando, e preencha o bairro.';
      travarEndereco(form, false);
      liberarDetalhes(form);
      return;
    }
    st.textContent = `${r.length} ${r.length === 1 ? 'endereço encontrado' : 'endereços encontrados'}. Toque para completar.`;
    lista.innerHTML = r.map((x) => `<li><button type="button" data-acao="usar-endereco" data-rua="${esc(x.rua)}" data-bairro="${esc(x.bairro)}" data-cep="${esc(x.cep)}">
      ${icone('i-pino')}<span><b>${esc(x.rua)}</b><small>${esc(x.bairro)}${x.cep ? ` · CEP ${esc(x.cep)}` : ''}${x.complemento ? ` · ${esc(x.complemento)}` : ''}</small></span></button></li>`).join('');
    lista.hidden = false;
  }, 450);
}

function ligarCheckout() {
  const form = $('#form-checkout');
  form.addEventListener('change', (e) => {
    if (e.target.name === 'pagamento') {
      form.querySelector('#ck-pagamento')?.classList.remove('erro');
      form.querySelector('#erro-pagamento').textContent = '';
    }
    if (e.target.name === 'maior' && e.target.checked) {
      form.querySelector('#ck-idade-label')?.classList.remove('erro');
      form.querySelector('#erro-maior').textContent = '';
    }
    atualizarResumo(form);
  });
  form.addEventListener('input', async (e) => {
    // corrigiu o campo: some a mensagem de erro dele
    if (e.target.getAttribute('aria-invalid') === 'true' && e.target.value.trim()) {
      e.target.removeAttribute('aria-invalid');
      const msg = form.querySelector(`#erro-${e.target.name}`);
      if (msg) msg.textContent = '';
    }
    if (e.target.id === 'ck-rua') { sugerirRuas(form, e.target.value); return; }
    if (e.target.id !== 'ck-cep') return;
    const el = e.target;
    const d = el.value.replace(/\D/g, '').slice(0, 8);
    el.value = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
    const st = $('#ck-cep-status', form);
    if (d.length !== 8) { st.textContent = 'Digite o CEP: a rua e o bairro aparecem sozinhos.'; return; }
    st.textContent = 'Buscando o endereço…';
    const r = await buscarCep(d);
    if (el.value.replace(/\D/g, '') !== d) return;
    if (!r) {
      st.textContent = 'CEP não encontrado. Digite a rua e o bairro abaixo.';
      travarEndereco(form, false);
      liberarDetalhes(form);
      $('#ck-rua', form).focus();
      return;
    }
    st.textContent = `CEP de ${r.cidade}/${r.uf}`;
    preencherEndereco(form, { rua: r.rua, bairro: r.bairro, cep: '' }, false);
  });
  // escolher uma rua sugerida
  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-acao="usar-endereco"]');
    if (!b) return;
    preencherEndereco(form, { rua: b.dataset.rua, bairro: b.dataset.bairro, cep: b.dataset.cep }, true);
  });
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#ck-rua-sug', form)?.hidden) {
      e.preventDefault();
      e.stopPropagation();
      $('#ck-rua-sug', form).hidden = true;
    }
    if (e.key === 'ArrowDown' && e.target.id === 'ck-rua') {
      const primeiro = $('#ck-rua-sug button', form);
      if (primeiro && !$('#ck-rua-sug', form).hidden) { e.preventDefault(); primeiro.focus(); }
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = lerFormulario(form);
    const ctx = contextoValidacao(d);
    const res = validar(d, ctx);
    if (!mostrarErros(form, res)) return;
    enviarPedido(d, ctx);
  });
}

function enviarPedido(d, ctx) {
  const c = cfg();
  const numero = gerarNumeroPedido();
  const t = calcularTaxa(d, c, S.modelo.bairros);
  const entrega = d.recebimento === 'entrega';
  const troco = d.pagamento === 'dinheiro' && !d.semTroco ? parsePreco(d.troco) : null;
  const pedido = {
    numero,
    itens: S.itens,
    categorias: S.modelo.categorias,
    recebimento: d.recebimento,
    taxa: entrega ? t.taxa : 0,
    bairroTaxa: t.bairroTaxa,
    cliente: { nome: d.nome, telefone: d.telefone },
    endereco: entrega ? { rua: d.rua, numero: d.numero, complemento: d.complemento, bairro: d.bairro, cep: d.cep, referencia: d.referencia } : null,
    pagamento: d.pagamento,
    troco,
    obs: d.obs,
    temAlcool: ctx.temAlcool,
  };
  const msg = montarMensagem(pedido);
  const url = linkWhatsApp(numeroWhatsApp(), msg);
  if (d.lembrar) salvarDados(d); else esquecerDados();

  const totalConhecido = !entrega || t.taxa !== null;
  const ultimo = {
    numero, url, pagamento: d.pagamento, itens: S.itens,
    total: ctx.subtotal + (entrega && t.taxa ? t.taxa : 0), totalConhecido, em: Date.now(),
  };
  store.set(K.ultimo, ultimo);
  S.itens = [];
  S.avisos = [];
  mudouCarrinho();
  fechar($('#dlg-checkout'));
  mostrarEnviado(ultimo);
  window.open(url, '_blank', 'noopener');
}

/* ---------------- Pedido enviado + Pix ---------------- */

function formatarChave(chave, tipo) {
  const d = chave.replace(/\D/g, '');
  const t = normalizar(tipo);
  if (t === 'cnpj' && d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (t === 'cpf' && d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return chave;
}

function carregarQr() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  return new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = 'assets/js/vendor/qrcode.js';
    s.onload = () => ok(window.qrcode);
    s.onerror = erro;
    document.head.append(s);
  });
}

function mostrarEnviado(r) {
  const c = cfg();
  const pix = r.pagamento === 'pix';
  const temChave = pix && c.chave_pix;
  let brcode = '';
  if (temChave) {
    try {
      brcode = gerarBrCode({
        chave: normalizarChave(c.chave_pix, c.tipo_chave),
        nome: c.nome_recebedor,
        cidade: c.cidade_pix,
        valorCentavos: r.totalConhecido ? r.total : 0,
        txid: r.numero,
      });
    } catch { brcode = ''; }
  }
  const chaveFmt = temChave ? formatarChave(c.chave_pix, c.tipo_chave) : '';
  const box = $('#enviado');
  box.innerHTML = `
    <header class="tela-topo">
      <button type="button" class="btn-fechar" data-acao="fechar" aria-label="Fechar">${icone('i-fechar')}</button>
      <h2>Pedido enviado</h2>
    </header>
    <div class="tela-meio">
      <div class="enviado-topo">
        <div class="selo-ok">${icone('i-check')}</div>
        <h2 id="enviado-titulo">Pedido <span class="n-pedido">${esc(r.numero)}</span> enviado!</h2>
        <p>Agora é só aguardar nossa confirmação no WhatsApp.</p>
        <p style="font-size:13px">Se o WhatsApp não abriu, toque em <b>Abrir conversa novamente</b>.</p>
      </div>
      ${pix ? `
        <p class="nota forte">${icone('i-alerta')}<span>Aguarde a confirmação dos itens no WhatsApp antes de pagar.</span></p>
        ${temChave ? `
        <div class="pix-card">
          <h3>${icone('i-pix')} Pagar com Pix</h3>
          <dl class="pix-dados">
            <dt>Chave Pix${c.tipo_chave ? ` (${esc(c.tipo_chave)})` : ''}</dt><dd>${esc(chaveFmt)}</dd>
            ${c.nome_recebedor ? `<dt>Recebedor</dt><dd>${esc(c.nome_recebedor)}</dd>` : ''}
            ${c.banco ? `<dt>Banco</dt><dd>${esc(c.banco)}</dd>` : ''}
            <dt>Valor</dt><dd>${r.totalConhecido ? brl(r.total) : `${brl(r.total)} + entrega (confirme o total no WhatsApp)`}</dd>
          </dl>
          <button type="button" class="btn-sec btn-largo" data-acao="copiar-chave" data-valor="${esc(c.chave_pix.replace(/[^\w@.+-]/g, ''))}">${icone('i-copiar')} Copiar chave Pix</button>
          ${brcode ? `
          <label class="sr" for="pix-codigo">Pix Copia e Cola</label>
          <textarea class="pix-codigo" id="pix-codigo" readonly>${esc(brcode)}</textarea>
          <button type="button" class="btn-pri btn-largo" data-acao="copiar-pix">${icone('i-copiar')} Copiar Pix Copia e Cola${r.totalConhecido ? ` · ${brl(r.total)}` : ''}</button>
          ${r.totalConhecido ? '' : '<p class="c-unit">Como a taxa de entrega ainda vai ser combinada, este código vem sem valor: digite o total confirmado no app do banco.</p>'}
          <details${desktop.matches ? ' open' : ''}><summary class="link" style="display:inline-block">Mostrar QR Code (pagar pelo computador)</summary><div class="qr" id="qr"></div></details>` : ''}
          <p class="nota">${icone('i-whatsapp')}<span>Depois de pagar, <b>envie o comprovante</b> nesta conversa.</span></p>
        </div>` : `<p class="nota">${icone('i-pix')}<span>A chave Pix será enviada na conversa do WhatsApp.</span></p>`}
      ` : `<p class="nota">${icone('i-whatsapp')}<span>Aguarde nosso retorno no WhatsApp.</span></p>`}
      <div class="enviado-acoes">
        <a class="btn-wpp btn-largo" href="${esc(r.url)}" target="_blank" rel="noopener">${icone('i-whatsapp')} Abrir conversa novamente</a>
        <div class="lado">
          <button type="button" class="btn-sec" data-acao="repetir-este">${icone('i-repetir')} Repetir este pedido</button>
          <button type="button" class="btn-sec" data-acao="novo-pedido">Fazer novo pedido</button>
        </div>
      </div>
    </div>`;
  abrir($('#dlg-enviado'));
  const details = $('details', box);
  const desenharQr = () => {
    const alvo = $('#qr', box);
    if (!alvo || alvo.firstChild) return;
    carregarQr().then((qrcode) => {
      const q = qrcode(0, 'M');
      q.addData(brcode);
      q.make();
      alvo.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true, title: 'QR Code do Pix', alt: 'QR Code do Pix' });
    }).catch(() => { alvo.textContent = 'Não foi possível gerar o QR Code. Use o Copia e Cola.'; });
  };
  if (details) {
    if (details.open) desenharQr();
    details.addEventListener('toggle', () => details.open && desenharQr());
  }
}

/* ---------------- Status, aviso e idade ---------------- */

function atualizarStatus() {
  const s = statusAgora(CONFIG.horarios, cfg().aberto_forcado || 'auto', CONFIG.fuso);
  const el = $('#status');
  el.classList.toggle('aberto', s.aberto);
  el.classList.toggle('fechado', !s.aberto);
  $('#status-txt').textContent = s.texto;
  $('#status-curto').textContent = s.curto;
  $('#hero-horario').textContent = s.curto;
  $('#aviso-fechado').hidden = s.aberto;
}

function atualizarAviso() {
  const a = cfg().aviso_do_dia;
  $('#aviso-dia').hidden = !a;
  $('#aviso-dia-txt').textContent = a || '';
}

function portaoIdade() {
  const dlg = $('#dlg-idade');
  $('#aviso-menor').hidden = S.idade !== 'menor';
  const raiz = document.documentElement;
  if (S.idade === '18' || S.idade === 'menor') { delete raiz.dataset.portao; return; }
  dlg.addEventListener('cancel', (e) => e.preventDefault());
  abrir(dlg);
  delete raiz.dataset.portao; // daqui em diante o <dialog> modal assume
}

function responderIdade(maior) {
  S.idade = maior ? '18' : 'menor';
  store.set(K.idade, S.idade);
  document.documentElement.dataset.idade = S.idade;
  const dlg = $('#dlg-idade');
  if (maior) {
    fechar(dlg);
  } else {
    $('.idade', dlg).innerHTML = `
      <img src="assets/icons/selo-96.png" width="72" height="72" alt="">
      <h2 id="idade-titulo">Tudo bem!</h2>
      <p class="idade-negado">A venda de bebidas alcoólicas é proibida para menores de 18 anos.</p>
      <p>Você ainda pode ver refrigerantes e outros itens sem álcool.</p>
      <div class="idade-botoes"><button type="button" class="btn-pri" data-acao="fechar">Ver itens sem álcool</button></div>`;
    $('.idade button', dlg).focus();
    // tira do carrinho o que tiver álcool
    const vis = new Set(S.modelo ? categoriasVisiveis().map((c) => c.id) : []);
    if (S.modelo) S.itens = S.itens.filter((i) => vis.has(i.categoria));
    mudouCarrinho();
  }
  $('#aviso-menor').hidden = S.idade !== 'menor';
  if (S.modelo) renderLista();
}

/* ---------------- Modo lista/grade ---------------- */

function aplicarModo() {
  const b = $('#alternar-modo');
  const grade = S.modo === 'grade';
  b.innerHTML = icone(grade ? 'i-lista' : 'i-grade');
  b.setAttribute('aria-label', grade ? 'Mostrar em lista' : 'Mostrar em grade');
  b.title = b.getAttribute('aria-label');
  $('#lista').className = `lista modo-${S.modo}`;
}

/* ---------------- Eventos ---------------- */

function ligarEventos() {
  document.addEventListener('click', (e) => {
    const sub = e.target.closest('.subaba');
    if (sub) { escolherSubaba(sub); return; }
    const el = e.target.closest('[data-acao], .aba, .atalho');
    if (!el) return;
    if (el.classList.contains('aba') || el.classList.contains('atalho')) {
      e.preventDefault();
      const alvo = document.getElementById(el.dataset.alvo);
      alvo?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      // seções desenhadas sob demanda podem mudar de altura no caminho: corrige a parada
      setTimeout(() => {
        const topo = alvo?.getBoundingClientRect().top ?? 0;
        if (Math.abs(topo - ($('.abas').offsetHeight + 8)) > 12) alvo?.scrollIntoView({ behavior: 'auto' });
      }, 600);
      history.replaceState(null, '', `#${el.dataset.alvo}`);
      return;
    }
    const a = el.dataset.acao;
    const p = el.dataset.id ? S.modelo?.porId.get(el.dataset.id) : null;
    switch (a) {
      case 'mais':
        if (!p) return;
        if (p.grupos.length) abrirProduto(p); else addSimples(p);
        break;
      case 'menos':
        if (p) menosProduto(p.id);
        break;
      case 'c-mais':
        S.itens = alterarQtd(S.itens, el.dataset.chave, 1); mudouCarrinho(); break;
      case 'c-menos':
        S.itens = alterarQtd(S.itens, el.dataset.chave, -1); mudouCarrinho(); break;
      case 'c-rem':
        S.itens = remover(S.itens, el.dataset.chave); mudouCarrinho(); break;
      case 'limpar':
        S.confirmarLimpar = true; renderCarrinho();
        $$('[data-acao="limpar-nao"]').find((b) => b.offsetParent)?.focus();
        break;
      case 'limpar-nao':
        S.confirmarLimpar = false; renderCarrinho(); break;
      case 'limpar-sim':
        S.itens = []; S.avisos = []; mudouCarrinho(); fechar($('#dlg-carrinho')); toast('Carrinho limpo'); break;
      case 'finalizar':
        abrirCheckout(); break;
      case 'voltar-carrinho':
        fechar($('#dlg-checkout'));
        if (!desktop.matches) abrir($('#dlg-carrinho'));
        break;
      case 'fechar':
        fechar(el.closest('dialog')); break;
      case 's-mais':
        S.qtd = Math.min(99, S.qtd + 1); atualizarBotaoSheet(); break;
      case 's-menos':
        S.qtd = Math.max(1, S.qtd - 1); atualizarBotaoSheet(); break;
      case 'compartilhar-cat':
        compartilhar(el.dataset.nome, `#${el.dataset.cat}`); break;
      case 'compartilhar-prod':
        if (S.produto) compartilhar(S.produto.nome, `#p-${S.produto.id}`); break;
      case 'sem-cep': {
        const form = $('#form-checkout');
        travarEndereco(form, false);
        $('#ck-rua', form).value = '';
        $('#ck-rua-status', form).textContent = 'Digite o nome da rua: mostramos as opções com o CEP.';
        $('#ck-rua', form).focus();
        break;
      }
      case 'esquecer-dados': {
        esquecerDados();
        const form = $('#form-checkout');
        ['nome', 'telefone', 'cep', 'rua', 'numero', 'complemento', 'bairro', 'referencia'].forEach((k) => {
          const f = form.elements[k]; if (f) f.value = '';
        });
        $('#ck-lembrar').checked = false;
        el.remove();
        toast('Dados apagados deste aparelho');
        break;
      }
      case 'copiar-chave':
        copiar(el.dataset.valor, 'Chave Pix copiada!'); break;
      case 'copiar-pix':
        copiar($('#pix-codigo').value, 'Pix Copia e Cola copiado!', $('#pix-codigo')); break;
      case 'repetir-este': {
        const u = store.get(K.ultimo, null);
        fechar($('#dlg-enviado'));
        if (u) repetirPedido(u.itens);
        break;
      }
      case 'novo-pedido':
        S.itens = []; mudouCarrinho(); fechar($('#dlg-enviado'));
        scrollTo({ top: 0 }); break;
      default:
    }
  });

  // fechar diálogos tocando fora
  for (const d of $$('dialog')) {
    d.addEventListener('click', (e) => {
      if (e.target === d && d.id !== 'dlg-idade') d.close();
    });
  }
  $('#dlg-produto').addEventListener('close', () => {
    if (location.hash.startsWith('#p-')) history.replaceState(null, '', location.pathname + location.search);
    S.produto = null;
  });

  // escolhas no sheet
  $('#form-produto').addEventListener('change', (e) => {
    const fs = e.target.closest('.grupo');
    if (fs && e.target.type === 'radio') {
      S.escolhas[fs.dataset.grupo] = e.target.value;
      fs.classList.remove('erro');
      $('#s-erro').textContent = '';
      if (fs.dataset.grupo !== SABOR) renderSabores();
      atualizarBotaoSheet();
    }
  });
  $('#form-produto').addEventListener('submit', (e) => { e.preventDefault(); enviarSheet(); });

  // créditos das fotos: carrega só quando abrir
  $('#creditos').addEventListener('toggle', async (e) => {
    const lista = $('#creditos-lista');
    if (!e.target.open || lista.dataset.ok) return;
    try {
      const c = await (await fetch('data/creditos-fotos.json')).json();
      const vistos = new Set();
      lista.innerHTML = c.filter((x) => !vistos.has(x.fonte) && vistos.add(x.fonte)).map((x) => `<li><a href="${esc(x.fonte)}" target="_blank" rel="noopener">${esc(x.titulo)}</a> · ${esc(x.autor)} · ${x.licencaUrl ? `<a href="${esc(x.licencaUrl)}" target="_blank" rel="noopener">${esc(x.licenca)}</a>` : esc(x.licenca)}</li>`).join('');
      lista.dataset.ok = '1';
    } catch {
      lista.innerHTML = '<li>Não foi possível carregar os créditos agora.</li>';
    }
  });

  $('#abrir-carrinho').addEventListener('click', () => abrir($('#dlg-carrinho')));
  $('#busca').addEventListener('input', filtrar);
  $('#alternar-modo').addEventListener('click', () => {
    S.modo = S.modo === 'grade' ? 'lista' : 'grade';
    store.set(K.modo, S.modo);
    aplicarModo();
  });
  $('#idade-sim').addEventListener('click', () => responderIdade(true));
  $('#idade-nao').addEventListener('click', () => responderIdade(false));
  $('#refazer-idade').addEventListener('click', () => {
    store.del(K.idade);
    location.reload();
  });
  $('#repetir-ultimo').addEventListener('click', () => {
    const u = store.get(K.ultimo, null);
    if (u) repetirPedido(u.itens);
  });
  $('#compartilhar-site').addEventListener('click', () => compartilhar('Cardápio da Adega KM28', ''));

  // instalar PWA
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    S.instalar = e;
    $('#instalar').hidden = false;
  });
  $('#instalar').addEventListener('click', async () => {
    if (!S.instalar) return;
    S.instalar.prompt();
    await S.instalar.userChoice.catch(() => null);
    S.instalar = null;
    $('#instalar').hidden = true;
  });

  // ao trocar celular ↔ desktop, fecha a gaveta
  desktop.addEventListener('change', () => fechar($('#dlg-carrinho')));

  // carrinho alterado em outra aba
  addEventListener('storage', (e) => {
    if (e.key === K.carrinho) {
      S.itens = sanitizar(store.get(K.carrinho, []));
      atualizarAcoes();
      renderCarrinho();
    }
  });

  ligarCheckout();
}

/* ---------------- Âncoras compartilhadas ---------------- */

function irParaAncora() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h) return;
  const el = document.getElementById(h);
  if (!el) return;
  el.scrollIntoView({ block: h.startsWith('p-') ? 'center' : 'start' });
  if (h.startsWith('p-')) {
    el.classList.add('piscar');
    setTimeout(() => el.classList.remove('piscar'), 1500);
  }
}

/* ---------------- Carregamento ---------------- */

function aplicarCatalogo(cru, origem) {
  S.modelo = montarModelo(cru, CONFIG);
  S.origem = origem;
  const r = revalidar(S.itens, S.modelo);
  if (r.avisos.length) {
    S.avisos = r.avisos;
    toast('Seu pedido foi atualizado');
  }
  if (S.idade === 'menor') {
    const vis = new Set(categoriasVisiveis().map((c) => c.id));
    r.itens = r.itens.filter((i) => vis.has(i.categoria));
  }
  S.itens = r.itens;
  salvarCarrinho();
  renderLista();
  renderCarrinho();
  atualizarStatus();
  atualizarAviso();
  $('#vazio-wpp').href = `https://wa.me/${numeroWhatsApp()}`;
  const quando = cru.atualizado ? ` · preços de ${cru.atualizado.split('-').reverse().join('/')}` : '';
  $('#origem').textContent = origem === 'planilha' ? 'Preços atualizados agora.' : `Catálogo ${origem === 'cache' ? 'salvo' : 'local'}${quando}.`;
}

async function iniciar() {
  aplicarModo();
  ligarEventos();
  renderCarrinho();
  atualizarStatus();
  portaoIdade();
  setInterval(atualizarStatus, 60_000);

  const usaPlanilha = Boolean(CONFIG.planilha?.produtos);
  const cache = usaPlanilha ? store.get(K.cache, null) : null;
  let mostrado = false;
  if (cache?.cru) {
    try { aplicarCatalogo(cache.cru, 'cache'); mostrado = true; irParaAncora(); } catch { /* cache ruim */ }
  }
  try {
    const { cru, origem } = await carregarCatalogo(CONFIG);
    if (origem === 'planilha') {
      store.set(K.cache, { cru, em: Date.now() });
      aplicarCatalogo(cru, origem);
    } else if (!mostrado) {
      aplicarCatalogo(cru, origem);
    }
  } catch (e) {
    if (!mostrado) {
      $('#lista').innerHTML = `<p class="nota erro">${icone('i-alerta')}<span>Não conseguimos carregar o cardápio. Verifique a internet ou <a href="https://wa.me/${CONFIG.whatsapp}">peça pelo WhatsApp</a>.</span></p>`;
    }
    console.error(e);
  }
  if (!mostrado) irParaAncora();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

iniciar();
