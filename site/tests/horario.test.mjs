import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusEm, statusAgora, formatarHora, agoraNoFuso } from '../js/horario.js';
import { CONFIG } from '../data/config.js';

const H = CONFIG.horarios;
const DOM = 0, SEG = 1, TER = 2, QUA = 3, QUI = 4, SEX = 5, SAB = 6;
const em = (dia, h, m = 0) => statusEm({ dia, minutos: h * 60 + m }, H);

test('segunda 08:59 → fechado, abre hoje às 09h', () => {
  const s = em(SEG, 8, 59);
  assert.equal(s.aberto, false);
  assert.equal(s.texto, 'Fechado · abre hoje às 09h');
});

test('segunda 01:30 → aberto (ainda é o expediente de domingo), fecha às 02h', () => {
  const s = em(SEG, 1, 30);
  assert.equal(s.aberto, true);
  assert.equal(s.texto, 'Aberto agora · fecha às 02h');
});

test('terça 01:00 → fechado (segunda fecha às 23h)', () => {
  assert.equal(em(TER, 1, 0).aberto, false);
});

test('quinta 23:30 → aberto, fecha às 02h', () => {
  const s = em(QUI, 23, 30);
  assert.equal(s.aberto, true);
  assert.equal(s.texto, 'Aberto agora · fecha às 02h');
});

test('sexta 01:59 → aberto (expediente de quinta)', () => {
  assert.equal(em(SEX, 1, 59).aberto, true);
});

test('sexta 02:00 → fechado, abre hoje às 11h', () => {
  const s = em(SEX, 2, 0);
  assert.equal(s.aberto, false);
  assert.equal(s.texto, 'Fechado · abre hoje às 11h');
});

test('outros horários', () => {
  assert.equal(em(SEG, 9, 0).aberto, true);
  assert.equal(em(QUA, 22, 59).texto, 'Aberto agora · fecha às 23h');
  assert.equal(em(QUA, 23, 0).texto, 'Fechado · abre amanhã às 11h');
  assert.equal(em(QUI, 1, 0).aberto, false, 'quarta não vira a madrugada');
  assert.equal(em(QUI, 10, 59).aberto, false);
  assert.equal(em(SAB, 0, 30).aberto, true);
  assert.equal(em(DOM, 1, 59).aberto, true, 'madrugada de sábado para domingo');
});

test('aberto_forcado da planilha manda', () => {
  assert.equal(statusEm({ dia: TER, minutos: 60 }, H, 'aberto').aberto, true);
  assert.equal(statusEm({ dia: QUI, minutos: 23 * 60 }, H, 'fechado').aberto, false);
});

test('fuso de São Paulo: 2026-11-06 04:30 UTC é sexta 01:30 em SP', () => {
  const d = new Date('2026-11-06T04:30:00Z');
  assert.deepEqual(agoraNoFuso(d), { dia: SEX, minutos: 90 });
  assert.equal(statusAgora(H, 'auto', 'America/Sao_Paulo', d).aberto, true);
});

test('formatarHora', () => {
  assert.equal(formatarHora(26 * 60), '02h');
  assert.equal(formatarHora(23 * 60 + 30), '23h30');
});
