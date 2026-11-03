import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc16, gerarBrCode, limparTxid, limparTexto, normalizarChave } from '../js/pix.js';

test('CRC16-CCITT-FALSE: valor de verificação padrão de "123456789" é 29B1', () => {
  assert.equal(crc16('123456789'), '29B1');
});

// Exemplo do Manual de Padrões para Iniciação do Pix (Banco Central), BR Code estático.
const EXEMPLO_BCB =
  '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR' +
  '5913Fulano de Tal6008BRASILIA62070503***63041D3D';

test('CRC do exemplo do manual do BR Code confere (1D3D)', () => {
  assert.equal(crc16(EXEMPLO_BCB.slice(0, -4)), '1D3D');
});

test('gerador reproduz exatamente o exemplo do manual do BR Code', () => {
  const p = gerarBrCode({
    chave: '123e4567-e12b-12d1-a456-426655440000',
    nome: 'Fulano de Tal',
    cidade: 'BRASILIA',
    txid: '***',
  });
  assert.equal(p, EXEMPLO_BCB);
});

test('Pix da adega com valor e txid do pedido', () => {
  const p = gerarBrCode({
    chave: normalizarChave('59.614.773/0001-00', 'CNPJ'),
    nome: 'KM28 COMERCIO DE BEBIDAS LTDA',
    cidade: 'SÃO PAULO',
    valorCentavos: 22600,
    txid: 'KM28-0211-4821',
  });
  assert.ok(p.startsWith('000201'));
  assert.ok(p.includes('0014br.gov.bcb.pix011459614773000100'));
  assert.ok(p.includes('5406226.00'), 'valor com ponto e 2 casas');
  assert.ok(p.includes('5924KM28 COMERCIO DE BEBIDAS'), 'nome cortado em 25, sem espaço no fim');
  assert.ok(p.includes('6009SAO PAULO'), 'cidade sem acento');
  assert.ok(p.includes('62160512KM2802114821'), 'txid só letras e números');
  assert.match(p, /6304[0-9A-F]{4}$/);
  assert.equal(crc16(p.slice(0, -4)), p.slice(-4));
});

test('valores pequenos e redondos', () => {
  assert.ok(gerarBrCode({ chave: 'x', nome: 'A', cidade: 'B', valorCentavos: 500 }).includes('54045.00'));
  assert.ok(gerarBrCode({ chave: 'x', nome: 'A', cidade: 'B', valorCentavos: 1 }).includes('54040.01'));
  assert.ok(!gerarBrCode({ chave: 'x', nome: 'A', cidade: 'B' }).includes('5404'), 'sem valor, sem campo 54');
});

test('limpeza de txid, textos e chaves', () => {
  assert.equal(limparTxid('KM28-0211-4821'), 'KM2802114821');
  assert.equal(limparTxid(''), '***');
  assert.equal(limparTxid('a'.repeat(40)).length, 25);
  assert.equal(limparTexto('São João da Boa Vista', 15), 'Sao Joao da Boa');
  assert.equal(normalizarChave('(11) 91581-7410', 'telefone'), '+5511915817410');
  assert.equal(normalizarChave('123.456.789-09', 'CPF'), '12345678909');
});

test('sem chave lança erro', () => {
  assert.throws(() => gerarBrCode({ chave: '', nome: 'A', cidade: 'B' }));
});
