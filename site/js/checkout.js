// Finalização: formulário, taxa de entrega, validação e busca de CEP (ViaCEP).

import { brl, esc, normalizar, parsePreco, store } from './util.js';
import { NOMES_PAGAMENTO } from './whatsapp.js';

const CHAVE_DADOS = 'km28.dados';

const ROTULOS_PAG = {
  pix: { icone: 'i-pix', sub: 'chave após enviar' },
  credito: { icone: 'i-cartao', sub: 'maquininha' },
  debito: { icone: 'i-cartao', sub: 'maquininha' },
  dinheiro: { icone: 'i-dinheiro', sub: 'informe o troco' },
};

export function dadosSalvos() {
  return store.get(CHAVE_DADOS, null);
}
export function esquecerDados() {
  store.del(CHAVE_DADOS);
}

/**
 * Taxa de entrega conforme a configuração.
 * @returns {{taxa:number|null, rotulo:string, bairroTaxa:string}} taxa null = a combinar
 */
export function calcularTaxa({ recebimento, bairro }, config, bairros) {
  if (recebimento !== 'entrega') return { taxa: 0, rotulo: '', bairroTaxa: '' };
  if (bairros.length) {
    // compara sem acento e sem maiúsculas: "Jardim Sao Rafael" = "Jardim São Rafael"
    const b = bairros.find((x) => normalizar(x.bairro) === normalizar(bairro));
    if (b && b.taxa !== null) return { taxa: b.taxa, rotulo: b.bairro, bairroTaxa: b.bairro };
    return { taxa: null, rotulo: 'a combinar', bairroTaxa: '' };
  }
  if (config.taxa_entrega !== null) return { taxa: config.taxa_entrega, rotulo: '', bairroTaxa: '' };
  return { taxa: null, rotulo: 'a combinar', bairroTaxa: '' };
}

/** HTML do formulário. */
export function htmlCheckout({ config, bairros, temAlcool, salvos }) {
  const s = salvos || {};
  const v = (k) => esc(s[k] || '');
  const pags = config.pagamentos.filter((p) => NOMES_PAGAMENTO[p]);
  // rua e bairro vêm do CEP; só ficam editáveis se o CEP não for encontrado
  const travado = ' readonly';
  // número, complemento e referência só liberam depois do CEP (ou de achar a rua)
  const bloq = s.cep && s.rua ? '' : ' disabled';

  return `
  <header class="tela-topo">
    <button type="button" class="btn-fechar" data-acao="voltar-carrinho" aria-label="Voltar ao pedido"><svg aria-hidden="true"><use href="#i-voltar"/></svg></button>
    <h2 id="checkout-titulo">Finalizar pedido</h2>
  </header>
  <div class="tela-meio">
    <div id="ck-erro-geral" role="alert"></div>

    <fieldset class="bloco">
      <legend>Como quer receber?</legend>
      <div class="chips" id="ck-recebimento">
        <div class="chip"><input type="radio" name="recebimento" id="rc-entrega" value="entrega" checked><label for="rc-entrega"><svg aria-hidden="true"><use href="#i-pino"/></svg>Entrega</label></div>
        ${config.retirada ? '<div class="chip"><input type="radio" name="recebimento" id="rc-retirada" value="retirada"><label for="rc-retirada"><svg aria-hidden="true"><use href="#i-sacola"/></svg>Retirada no balcão</label></div>' : ''}
      </div>
      <p class="nota" id="ck-retirada-info" hidden><svg aria-hidden="true"><use href="#i-pino"/></svg><span>Retire na <b>Rua Frei Amador Arrais, 58</b> · Jardim São Rafael.</span></p>
    </fieldset>

    <fieldset class="bloco">
      <legend>Seus dados</legend>
      <div class="campo">
        <label for="ck-nome">Nome</label>
        <input id="ck-nome" name="nome" autocomplete="name" value="${v('nome')}" aria-describedby="erro-nome" required>
        <p class="msg-erro" id="erro-nome"></p>
      </div>
      <div class="campo">
        <label for="ck-telefone">Telefone <span class="opc">(opcional)</span></label>
        <input id="ck-telefone" name="telefone" type="tel" inputmode="tel" autocomplete="tel" value="${v('telefone')}">
      </div>
    </fieldset>

    <fieldset class="bloco" id="ck-endereco">
      <legend>Endereço de entrega</legend>
      <div class="linha-2 linha-2-igual">
        <div class="campo">
          <label for="ck-cep">CEP</label>
          <input id="ck-cep" name="cep" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000" value="${v('cep')}" aria-describedby="ck-cep-status erro-cep">
          <p class="msg-erro" id="erro-cep"></p>
        </div>
        <div class="campo">
          <label for="ck-numero">Número</label>
          <input id="ck-numero" name="numero" inputmode="text" autocomplete="address-line2" value="${v('numero')}" placeholder="depois do CEP"${bloq} aria-describedby="erro-numero">
          <p class="msg-erro" id="erro-numero"></p>
        </div>
      </div>
      <p class="ajuda ck-cep-status" id="ck-cep-status" aria-live="polite">Comece pelo CEP: rua e bairro aparecem sozinhos.</p>
      <button type="button" class="link link-pequeno" data-acao="sem-cep">Não sei meu CEP</button>

      <div class="endereco-auto">
        <div class="campo campo-rua">
          <label for="ck-rua">Rua</label>
          <div class="com-icone">
            <svg aria-hidden="true"><use href="#i-pino"/></svg>
            <input id="ck-rua" name="rua" autocomplete="off" value="${v('rua')}" placeholder="preenchida pelo CEP"${travado} aria-describedby="ck-rua-status erro-rua" aria-controls="ck-rua-sug">
          </div>
          <p class="ajuda" id="ck-rua-status" aria-live="polite"></p>
          <ul class="sugestoes" id="ck-rua-sug" hidden></ul>
          <p class="msg-erro" id="erro-rua"></p>
        </div>
        <div class="campo">
          <label for="ck-bairro">Bairro</label>
          <input id="ck-bairro" name="bairro" autocomplete="off" value="${v('bairro')}" placeholder="preenchido pelo CEP"${travado} aria-describedby="erro-bairro">
          <p class="msg-erro" id="erro-bairro"></p>
        </div>
        <p class="nota" id="ck-taxa-info" hidden></p>
      </div>
      <div class="campo">
        <label for="ck-complemento">Complemento <span class="opc">(opcional)</span></label>
        <input id="ck-complemento" name="complemento" value="${v('complemento')}" placeholder="ap, bloco, casa 2…"${bloq}>
      </div>
      <div class="campo">
        <label for="ck-referencia">Ponto de referência <span class="opc">(opcional)</span></label>
        <input id="ck-referencia" name="referencia" value="${v('referencia')}" placeholder="portão azul, perto da padaria…"${bloq}>
      </div>
    </fieldset>

    <fieldset class="bloco">
      <legend>Forma de pagamento</legend>
      <div class="chips" id="ck-pagamento" aria-describedby="erro-pagamento">
        ${pags.map((p) => `<div class="chip"><input type="radio" name="pagamento" id="pg-${p}" value="${p}"><label for="pg-${p}"><svg aria-hidden="true"><use href="#${ROTULOS_PAG[p].icone}"/></svg><span>${NOMES_PAGAMENTO[p]}<small>${ROTULOS_PAG[p].sub}</small></span></label></div>`).join('')}
      </div>
      <p class="msg-grupo" id="erro-pagamento"></p>
      <p class="nota forte" id="ck-pix-info" hidden><svg aria-hidden="true"><use href="#i-alerta"/></svg><span>Depois de enviar, você vê a chave Pix. <b>Aguarde a confirmação dos itens no WhatsApp antes de pagar.</b></span></p>
      <div id="ck-troco" hidden>
        <div class="campo" style="margin-top:12px">
          <label for="ck-troco-valor">Troco para quanto?</label>
          <input id="ck-troco-valor" name="troco" inputmode="decimal" placeholder="Ex.: 100,00" aria-describedby="erro-troco">
          <p class="msg-erro" id="erro-troco"></p>
        </div>
        <label class="check"><input type="checkbox" name="sem_troco" id="ck-sem-troco"> Não preciso de troco</label>
      </div>
    </fieldset>

    <div class="bloco">
      <div class="campo" style="margin:0">
        <label for="ck-obs">Observações do pedido <span class="opc">(opcional)</span></label>
        <textarea id="ck-obs" name="obs" rows="2" placeholder="Ex.: interfone não funciona, ligar ao chegar"></textarea>
      </div>
    </div>

    <div class="bloco">
      <p class="bloco-titulo">Resumo</p>
      <div class="resumo" id="ck-resumo"></div>
    </div>

    ${temAlcool ? `<label class="check" id="ck-idade-label"><input type="checkbox" name="maior" id="ck-maior" aria-describedby="erro-maior"> <span>Confirmo que tenho 18 anos ou mais. Sei que o documento pode ser solicitado na entrega.</span></label>
    <p class="msg-grupo" id="erro-maior"></p>` : ''}
    <label class="check"><input type="checkbox" name="lembrar" id="ck-lembrar" ${salvos ? 'checked' : 'checked'}> <span>Lembrar nome e endereço neste aparelho</span></label>
    ${salvos ? '<button type="button" class="link" data-acao="esquecer-dados">Esquecer meus dados</button>' : ''}
  </div>
  <footer class="tela-pe">
    <button type="submit" class="btn-wpp btn-largo"><svg aria-hidden="true"><use href="#i-whatsapp"/></svg>Enviar pedido no WhatsApp</button>
  </footer>`;
}

/** Lê o formulário para um objeto simples. */
export function lerFormulario(form) {
  const fd = new FormData(form);
  const g = (k) => String(fd.get(k) ?? '').trim();
  let bairro = g('bairro');
  if (bairro === '__outro') bairro = '';
  return {
    recebimento: g('recebimento') || 'entrega',
    nome: g('nome'),
    telefone: g('telefone'),
    cep: g('cep'),
    rua: g('rua'),
    numero: g('numero'),
    complemento: g('complemento'),
    bairro,
    bairroOutro: g('bairro') === '__outro',
    referencia: g('referencia'),
    pagamento: g('pagamento'),
    troco: g('troco'),
    semTroco: fd.get('sem_troco') === 'on',
    obs: g('obs'),
    maior: fd.get('maior') === 'on',
    lembrar: fd.get('lembrar') === 'on',
  };
}

/**
 * Valida. Retorna { erros: {campo: mensagem}, geral: string[] }.
 * @param {object} d   dados do formulário
 * @param {object} ctx { total, temAlcool, itensBalcao: string[], pedidoMinimo, subtotal, bairros }
 */
export function validar(d, ctx) {
  const erros = {};
  const geral = [];
  if (!d.nome) erros.nome = 'Diga seu nome para a gente te chamar.';
  if (d.recebimento === 'entrega') {
    if (!d.cep && !d.rua) erros.cep = 'Digite o CEP (ou toque em "Não sei meu CEP").';
    else if (!d.rua) erros.rua = 'Informe a rua.';
    // número só é cobrado depois que o endereço foi encontrado (antes disso o campo fica bloqueado)
    if (d.rua && !d.numero) erros.numero = 'Informe o número (ou "s/n").';
    if (d.rua && !d.bairro && !d.bairroOutro) erros.bairro = 'Informe o bairro.';
    if (ctx.itensBalcao?.length) {
      geral.push(`${ctx.itensBalcao.join(', ')} ${ctx.itensBalcao.length > 1 ? 'são vendidos' : 'é vendido'} só no balcão. Escolha "Retirada no balcão" ou tire do pedido.`);
    }
  }
  if (!d.pagamento) erros.pagamento = 'Escolha a forma de pagamento.';
  if (d.pagamento === 'dinheiro' && !d.semTroco) {
    const t = parsePreco(d.troco);
    if (t === null) erros.troco = 'Informe o valor para o troco ou marque "Não preciso de troco".';
    else if (t < ctx.total) erros.troco = `O troco precisa ser para ${brl(ctx.total)} ou mais.`;
  }
  if (ctx.temAlcool && !d.maior) erros.maior = 'Confirme que você tem 18 anos ou mais.';
  if (ctx.pedidoMinimo && ctx.subtotal < ctx.pedidoMinimo) {
    geral.push(`Faltam ${brl(ctx.pedidoMinimo - ctx.subtotal)} para o pedido mínimo de ${brl(ctx.pedidoMinimo)}.`);
  }
  return { erros, geral };
}

/** Busca o CEP no ViaCEP. Retorna {rua, bairro} ou null. */
export async function buscarCep(cep, fetchFn = fetch) {
  const d = String(cep).replace(/\D/g, '');
  if (d.length !== 8) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetchFn(`https://viacep.com.br/ws/${d}/json/`, { signal: ctrl.signal });
    if (!r.ok) return null;
    const j = await r.json();
    if (j.erro) return null;
    return { rua: j.logradouro || '', bairro: j.bairro || '', cidade: j.localidade || '', uf: j.uf || '' };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Busca endereços pelo nome da rua no ViaCEP (cidade e UF da adega).
 * Retorna até 6 opções: [{ rua, bairro, cep, complemento }].
 */
export async function buscarEndereco(texto, { cidade = 'São Paulo', uf = 'SP' } = {}, fetchFn = fetch) {
  const termo = String(texto)
    .replace(/\d+/g, ' ')
    .replace(/^\s*(rua|r\.|av\.?|avenida|travessa|tv\.?|alameda|al\.?|estrada|estr\.?|praça|pça\.?)\s+/i, '')
    .replace(/[^\p{L}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (termo.length < 3) return [];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const url = `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(cidade)}/${encodeURIComponent(termo)}/json/`;
    const r = await fetchFn(url, { signal: ctrl.signal });
    if (!r.ok) return [];
    const lista = await r.json();
    if (!Array.isArray(lista)) return [];
    const vistos = new Set();
    const saida = [];
    for (const e of lista) {
      const chave = `${e.logradouro}|${e.bairro}`;
      if (!e.logradouro || vistos.has(chave)) continue;
      vistos.add(chave);
      saida.push({ rua: e.logradouro, bairro: e.bairro || '', cep: e.cep || '', complemento: e.complemento || '' });
      if (saida.length === 6) break;
    }
    return saida;
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

export function salvarDados(d) {
  const { nome, telefone, cep, rua, numero, complemento, bairro, referencia } = d;
  store.set(CHAVE_DADOS, { nome, telefone, cep, rua, numero, complemento, bairro, referencia });
}

/** Mostra erros no formulário e foca o primeiro. */
export function mostrarErros(form, { erros, geral }) {
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  form.querySelectorAll('.msg-erro, .msg-grupo').forEach((el) => { el.textContent = ''; });
  form.querySelectorAll('.chips.erro, .check.erro').forEach((el) => el.classList.remove('erro'));
  const boxGeral = form.querySelector('#ck-erro-geral');
  boxGeral.innerHTML = geral.map((g) => `<p class="nota erro"><svg aria-hidden="true"><use href="#i-alerta"/></svg><span>${esc(g)}</span></p>`).join('');

  const ordem = ['nome', 'cep', 'rua', 'numero', 'bairro', 'pagamento', 'troco', 'maior'];
  let primeiro = geral.length ? boxGeral : null;
  for (const campo of ordem) {
    if (!erros[campo]) continue;
    const msg = form.querySelector(`#erro-${campo}`);
    if (msg) msg.textContent = erros[campo];
    let alvo = null;
    if (campo === 'pagamento') {
      form.querySelector('#ck-pagamento')?.classList.add('erro');
      alvo = form.querySelector('#ck-pagamento input');
    } else if (campo === 'maior') {
      form.querySelector('#ck-idade-label')?.classList.add('erro');
      alvo = form.querySelector('#ck-maior');
    } else {
      alvo = form.querySelector(`[name="${campo}"]`);
      alvo?.setAttribute('aria-invalid', 'true');
    }
    if (!primeiro) primeiro = alvo;
  }
  if (primeiro) {
    if (primeiro === boxGeral) {
      boxGeral.scrollIntoView({ block: 'center' });
      boxGeral.setAttribute('tabindex', '-1');
      boxGeral.focus({ preventScroll: true });
    } else {
      primeiro.focus();
      primeiro.scrollIntoView({ block: 'center' });
    }
  }
  return !primeiro;
}
