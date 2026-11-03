// Aberto/fechado no fuso de São Paulo, com expediente que passa da meia-noite.
// Ex.: quinta 11h às 02h -> sexta 01:59 ainda é expediente de quinta.

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Dia da semana (0 = domingo) e minutos desde 00:00 no fuso informado. */
export function agoraNoFuso(data = new Date(), fuso = 'America/Sao_Paulo') {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(data);
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { dia, minutos: Number(p.hour) * 60 + Number(p.minute) };
}

/** 120 -> "02h"; 1410 -> "23h30" */
export function formatarHora(minutos) {
  const m = ((minutos % 1440) + 1440) % 1440;
  const h = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = m % 60;
  return mm ? `${h}h${String(mm).padStart(2, '0')}` : `${h}h`;
}

/**
 * Calcula o status para um dia da semana e horário.
 * @param {{dia:number, minutos:number}} momento
 * @param {Record<number,{abre:number,fecha:number}>} horarios
 * @param {'auto'|'aberto'|'fechado'} forcado
 */
export function statusEm({ dia, minutos }, horarios, forcado = 'auto') {
  const hoje = horarios[dia];
  const ontem = horarios[(dia + 6) % 7];
  let aberto = false;
  let fechaAs = null;

  // expediente de hoje
  if (hoje && minutos >= hoje.abre && minutos < hoje.fecha) {
    aberto = true;
    fechaAs = hoje.fecha;
  }
  // madrugada que ainda é o expediente de ontem
  if (!aberto && ontem && ontem.fecha > 1440 && minutos < ontem.fecha - 1440) {
    aberto = true;
    fechaAs = ontem.fecha - 1440;
  }

  const f = String(forcado || 'auto').toLowerCase();
  if (f === 'aberto') return { aberto: true, forcado: true, texto: 'Aberto agora', curto: 'Aberto agora' };
  if (f === 'fechado') return { aberto: false, forcado: true, texto: 'Fechado agora', curto: 'Fechado agora' };

  if (aberto) {
    const h = formatarHora(fechaAs);
    return { aberto: true, fechaAs, texto: `Aberto agora · fecha às ${h}`, curto: `Aberto · até ${h}` };
  }

  // próxima abertura
  if (hoje && minutos < hoje.abre) {
    const h = formatarHora(hoje.abre);
    return { aberto: false, texto: `Fechado · abre hoje às ${h}`, curto: `Fechado · abre ${h}` };
  }
  for (let i = 1; i <= 7; i++) {
    const d = (dia + i) % 7;
    if (horarios[d]) {
      const quando = i === 1 ? 'amanhã' : DIAS[d];
      const h = formatarHora(horarios[d].abre);
      return { aberto: false, texto: `Fechado · abre ${quando} às ${h}`, curto: `Fechado · abre ${quando} ${h}` };
    }
  }
  return { aberto: false, texto: 'Fechado', curto: 'Fechado' };
}

/** Status agora, no fuso configurado. */
export function statusAgora(horarios, forcado = 'auto', fuso = 'America/Sao_Paulo', data = new Date()) {
  return statusEm(agoraNoFuso(data, fuso), horarios, forcado);
}
