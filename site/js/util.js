// Utilidades compartilhadas. Valores sempre em centavos (inteiros).

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 3200 -> "R$ 32,00" (com espaço normal, não o espaço especial do Intl). */
export function brl(centavos) {
  return fmt.format((centavos || 0) / 100).replace(/ /g, ' ');
}

/** "Heineken 0.0" -> "heineken 0.0" sem acento, para busca. */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Escapa texto para colocar dentro de HTML. */
export function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

/**
 * Converte o que a pessoa digitou na planilha para centavos.
 * Aceita 32 · 32,00 · 32.5 · R$ 1.234,50 · 3200 (já em centavos, se vier número inteiro do JSON).
 * Retorna null se vazio ou inválido.
 */
export function parsePreco(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? Math.round(valor) : null;
  let s = String(valor).replace(/R\$|\s/gi, '').trim();
  if (!s) return null;
  if (s.includes(',') && s.includes('.') && s.lastIndexOf('.') > s.lastIndexOf(',')) {
    // formato americano: 1,234.50
    s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    // formato brasileiro: ponto é milhar, vírgula é decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234" = mil duzentos e trinta e quatro
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** "SIM", "sim", "S", "x", "TRUE", "1" -> true; "NÃO", "nao", "0", "" -> false */
export function parseBool(valor, padrao = false) {
  if (typeof valor === 'boolean') return valor;
  const s = normalizar(valor);
  if (!s) return padrao;
  if (['sim', 's', 'x', 'true', '1', 'yes', 'ok'].includes(s)) return true;
  if (['nao', 'n', 'false', '0', 'no', '-'].includes(s)) return false;
  return padrao;
}

/** localStorage que nunca quebra o site (modo privado, bloqueado etc.). */
export const store = {
  get(chave, padrao = null) {
    try {
      const v = globalThis.localStorage?.getItem(chave);
      return v === null || v === undefined ? padrao : JSON.parse(v);
    } catch {
      return padrao;
    }
  },
  set(chave, valor) {
    try {
      globalThis.localStorage?.setItem(chave, JSON.stringify(valor));
      return true;
    } catch {
      return false;
    }
  },
  del(chave) {
    try {
      globalThis.localStorage?.removeItem(chave);
    } catch { /* sem armazenamento */ }
  },
};
