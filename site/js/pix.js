// Pix Copia e Cola (BR Code estático, padrão EMV do Banco Central).

/** CRC16-CCITT-FALSE: polinômio 0x1021, valor inicial 0xFFFF. Retorna 4 dígitos hex maiúsculos. */
export function crc16(texto) {
  let crc = 0xffff;
  const bytes = new TextEncoder().encode(texto);
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Campo ID + tamanho (2 dígitos) + valor. */
function campo(id, valor) {
  const v = String(valor);
  if (v.length > 99) throw new Error(`Campo ${id} passou de 99 caracteres`);
  return id + String(v.length).padStart(2, '0') + v;
}

/** Tira acentos e caracteres fora do básico, corta no limite. */
export function limparTexto(texto, max) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .\-/&]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

/** txid: só letras e números, até 25. Vazio vira "***" (sem identificador). */
export function limparTxid(txid) {
  if (txid === '***') return '***';
  const t = String(txid ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25);
  return t || '***';
}

/** Chave do Pix no formato do BR Code: CPF/CNPJ só dígitos; telefone com +55; e-mail minúsculo. */
export function normalizarChave(chave, tipo = '') {
  const c = String(chave ?? '').trim();
  const t = String(tipo).toLowerCase();
  if (t === 'cnpj' || t === 'cpf') return c.replace(/\D/g, '');
  if (t === 'telefone' || t === 'celular') {
    const d = c.replace(/\D/g, '');
    return d.startsWith('55') ? `+${d}` : `+55${d}`;
  }
  if (t === 'email' || t === 'e-mail') return c.toLowerCase();
  return c;
}

/**
 * Gera o Pix Copia e Cola.
 * @param {{chave:string, nome:string, cidade:string, valorCentavos?:number, txid?:string}} d
 */
export function gerarBrCode({ chave, nome, cidade, valorCentavos, txid }) {
  if (!chave) throw new Error('Sem chave Pix');
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', chave);
  let p = '';
  p += campo('00', '01');
  p += campo('26', conta);
  p += campo('52', '0000');
  p += campo('53', '986');
  if (valorCentavos && valorCentavos > 0) {
    p += campo('54', (valorCentavos / 100).toFixed(2));
  }
  p += campo('58', 'BR');
  p += campo('59', limparTexto(nome, 25) || 'RECEBEDOR');
  p += campo('60', limparTexto(cidade, 15) || 'BRASIL');
  p += campo('62', campo('05', limparTxid(txid)));
  p += '6304';
  return p + crc16(p);
}
