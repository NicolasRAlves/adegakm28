// Monta o número do pedido e a mensagem que vai para o WhatsApp da adega.

import { brl } from './util.js';
import { descricaoItem } from './carrinho.js';

const PAGAMENTOS = {
  pix: 'Pix (vou pagar após a confirmação do pedido)',
  credito: 'Cartão de crédito na entrega',
  debito: 'Cartão de débito na entrega',
  dinheiro: 'Dinheiro',
};

export const NOMES_PAGAMENTO = {
  pix: 'Pix',
  credito: 'Crédito',
  debito: 'Débito',
  dinheiro: 'Dinheiro',
};

/** KM28-0211-4821: dia+mês (fuso de SP) + 4 dígitos aleatórios. */
export function gerarNumeroPedido(data = new Date(), aleatorio = Math.random) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
  }).formatToParts(data).map((x) => [x.type, x.value]));
  const n = String(Math.floor(aleatorio() * 10000)).padStart(4, '0');
  return `KM28-${p.day}${p.month}-${n}`;
}

/**
 * @param {object} pedido
 * @param {string} pedido.numero
 * @param {object[]} pedido.itens
 * @param {object[]} pedido.categorias
 * @param {'entrega'|'retirada'} pedido.recebimento
 * @param {number|null} pedido.taxa   centavos; null = a combinar
 * @param {string} [pedido.bairroTaxa]
 * @param {object} pedido.cliente   { nome, telefone }
 * @param {object} [pedido.endereco] { rua, numero, complemento, bairro, cep, referencia }
 * @param {string} pedido.pagamento  pix | credito | debito | dinheiro
 * @param {number|null} [pedido.troco] centavos; null = não precisa
 * @param {string} [pedido.obs]
 * @param {boolean} [pedido.temAlcool]
 */
export function montarMensagem(pedido) {
  const L = [];
  const sub = pedido.itens.reduce((s, i) => s + i.preco * i.qtd, 0);
  const entrega = pedido.recebimento === 'entrega';
  const taxa = entrega ? pedido.taxa : 0;
  const total = sub + (taxa || 0);

  L.push('*NOVO PEDIDO · ADEGA KM28*');
  L.push(`Pedido: ${pedido.numero}`);
  L.push('');
  L.push('*Itens*');
  for (const i of pedido.itens) {
    L.push(`${i.qtd}x ${descricaoItem(i, pedido.categorias)} — ${brl(i.preco * i.qtd)}`);
    if (i.obs) L.push(`   obs: ${i.obs}`);
  }
  L.push('');
  L.push(`Subtotal: ${brl(sub)}`);
  if (entrega) {
    const onde = pedido.bairroTaxa ? ` (${pedido.bairroTaxa})` : '';
    L.push(taxa === null || taxa === undefined ? `Entrega${onde}: a combinar` : `Entrega${onde}: ${taxa ? brl(taxa) : 'grátis'}`);
  }
  L.push(taxa === null || taxa === undefined
    ? `*TOTAL: ${brl(total)} + entrega*`
    : `*TOTAL: ${brl(total)}*`);
  L.push('');

  if (entrega) {
    const e = pedido.endereco || {};
    L.push('*Receber:* Entrega');
    const linha1 = [`${e.rua}, ${e.numero}`, e.complemento, e.bairro].filter(Boolean).join(' — ');
    L.push(linha1);
    if (e.cep) L.push(`CEP ${e.cep}`);
    if (e.referencia) L.push(`Ref.: ${e.referencia}`);
  } else {
    L.push('*Receber:* Retirada no balcão');
  }
  L.push('');

  let pag = PAGAMENTOS[pedido.pagamento] || pedido.pagamento;
  if (!entrega) pag = pag.replace('na entrega', 'na retirada');
  if (pedido.pagamento === 'dinheiro') {
    pag += pedido.troco ? ` — troco para ${brl(pedido.troco)}` : ' — não preciso de troco';
  }
  L.push(`*Pagamento:* ${pag}`);
  L.push(`*Cliente:* ${pedido.cliente.nome}`);
  if (pedido.cliente.telefone) L.push(`*Telefone:* ${pedido.cliente.telefone}`);
  if (pedido.obs) {
    L.push('');
    L.push(`*Observações:* ${pedido.obs}`);
  }
  if (pedido.temAlcool) {
    L.push('');
    L.push('Confirmo ter 18 anos ou mais.');
  }
  return L.join('\n');
}

export function linkWhatsApp(numero, mensagem) {
  return `https://wa.me/${String(numero).replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`;
}
