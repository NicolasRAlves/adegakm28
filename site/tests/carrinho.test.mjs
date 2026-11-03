import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { montarModelo, parseCSV, csvParaObjetos, configDeLinhas, precoComEscolhas, escolhasValidas, SABOR } from '../js/catalogo.js';
import { adicionar, alterarQtd, remover, subtotal, contar, revalidar, descricaoItem, sanitizar } from '../js/carrinho.js';
import { parsePreco, brl, normalizar } from '../js/util.js';
import { montarMensagem, gerarNumeroPedido, linkWhatsApp } from '../js/whatsapp.js';
import { CONFIG } from '../data/config.js';
import { calcularTaxa } from '../js/checkout.js';

const cru = JSON.parse(readFileSync(new URL('../data/catalogo.json', import.meta.url), 'utf8'));
const modelo = montarModelo(cru, CONFIG);
const P = (id) => modelo.porId.get(id);

test('preço da planilha vira centavos', () => {
  assert.equal(parsePreco('32'), 3200);
  assert.equal(parsePreco('32,00'), 3200);
  assert.equal(parsePreco('32,5'), 3250);
  assert.equal(parsePreco('R$ 1.234,50'), 123450);
  assert.equal(parsePreco('1.234'), 123400);
  assert.equal(parsePreco('39.90'), 3990);
  assert.equal(parsePreco('1,234.50'), 123450, 'planilha em formato americano');
  assert.equal(parsePreco(''), null);
  assert.equal(parsePreco('abc'), null);
  assert.equal(parsePreco(3200), 3200, 'número do JSON já está em centavos');
});

test('formatação em reais', () => {
  assert.equal(brl(22600), 'R$ 226,00');
  assert.equal(brl(5), 'R$ 0,05');
});

test('busca ignora acentos', () => {
  assert.ok(P('heineken-zero-8').busca.includes(normalizar('heine')));
  assert.ok(P('coca-zero-2l').busca.includes(normalizar('acucar')));
});

test('catálogo: categorias com produtos aparecem, as vazias somem', () => {
  assert.deepEqual(modelo.categorias.map((c) => c.id),
    ['cervejas', 'combos-whisky', 'combos-gin', 'doses-whisky', 'narguile', 'cigarros', 'refrigerantes', 'agua', 'mercearia']);
  assert.equal(modelo.produtos.length, 14 + 10 + 9 + 9 + 3 + 5 + 4 + 7 + 3 + 2);
});

test('Rocks: Red Bull = R$ 100, Bally = R$ 70', () => {
  assert.equal(precoComEscolhas(P('gin-rocks'), { 'Energético': 'Red Bull' }), 10000);
  assert.equal(precoComEscolhas(P('gin-rocks'), { 'Energético': 'Bally' }), 7000);
  assert.equal(P('gin-rocks').precoMin, 7000);
  assert.equal(P('gin-rocks').precoMax, 10000);
});

test('Eternity/Invictus exige gin e energético', () => {
  const p = P('gin-eternity-invictus');
  assert.throws(() => adicionar([], { produto: p, escolhas: { 'Energético': 'Red Bull' } }));
  const c = adicionar([], { produto: p, escolhas: { Gin: 'Invictus', 'Energético': 'Red Bull', [SABOR]: 'Tradicional' } });
  assert.equal(c[0].preco, 8000);
  assert.equal(descricaoItem(c[0], modelo.categorias), 'Combo Eternity / Invictus (Invictus, Red Bull Tradicional)');
});

test('combo premium: energético obrigatório, mesmo preço', () => {
  const p = P('gin-gordons');
  assert.throws(() => adicionar([], { produto: p }));
  const a = adicionar([], { produto: p, escolhas: { 'Energético': 'Red Bull', [SABOR]: 'Melancia' } });
  const b = adicionar([], { produto: p, escolhas: { 'Energético': 'Bally', [SABOR]: 'Tropical' } });
  assert.equal(a[0].preco, b[0].preco);
});

test('combo whisky: escolhe o gelo', () => {
  assert.throws(() => adicionar([], { produto: P('cw-black-label'), escolhas: { Gelo: '1 saco de gelo 5 kg', 'Energético': 'Red Bull' } }), 'falta o sabor do Red Bull');
  const c = adicionar([], { produto: P('cw-black-label'), escolhas: { Gelo: '1 saco de gelo 5 kg', 'Energético': 'Red Bull', [SABOR]: 'Tropical' } });
  assert.equal(c[0].preco, 22000);
  assert.equal(descricaoItem(c[0], modelo.categorias), 'Combo Black Label (1 saco de gelo 5 kg, Red Bull Tropical)');
});

test('adicionar igual soma; stepper; remover; subtotal em centavos', () => {
  let c = [];
  c = adicionar(c, { produto: P('heineken-8') });
  c = adicionar(c, { produto: P('heineken-8') });
  c = adicionar(c, { produto: P('refri-lata'), escolhas: { Sabor: 'Coca-Cola' } });
  c = adicionar(c, { produto: P('refri-lata'), escolhas: { Sabor: 'Coca-Cola' }, obs: 'bem gelada' });
  assert.equal(c.length, 3);
  assert.equal(contar(c), 4);
  assert.equal(subtotal(c), 3800 * 2 + 500 * 2);
  c = alterarQtd(c, c[0].chave, -2);
  assert.equal(c.length, 2);
  c = remover(c, c[0].chave);
  assert.equal(contar(c), 1);
});

test('item esgotado não adiciona', () => {
  const esg = { ...P('skol-15'), disponivel: false };
  assert.throws(() => adicionar([], { produto: esg }));
});

test('variante esgotada não adiciona', () => {
  const v = structuredClone(cru);
  v.variantes.find((x) => x.produto_id === 'gin-rocks' && x.nome === 'Red Bull').disponivel = 'NÃO';
  const m = montarModelo(v, CONFIG);
  assert.throws(() => adicionar([], { produto: m.porId.get('gin-rocks'), escolhas: { 'Energético': 'Red Bull' } }));
  assert.equal(adicionar([], { produto: m.porId.get('gin-rocks'), escolhas: { 'Energético': 'Bally', [SABOR]: 'Tradicional' } })[0].preco, 7000);
});

test('revalidação: preço mudou e item esgotou', () => {
  let c = adicionar([], { produto: P('heineken-8') });
  c = adicionar(c, { produto: P('skol-15') });
  const novo = structuredClone(cru);
  novo.produtos.find((p) => p.id === 'heineken-8').preco = '40,00';
  novo.produtos.find((p) => p.id === 'skol-15').disponivel = 'NÃO';
  const r = revalidar(c, montarModelo(novo, CONFIG));
  assert.equal(r.itens.length, 1);
  assert.equal(r.itens[0].preco, 4000);
  assert.deepEqual(r.avisos, [
    'O preço de Heineken lata · pack com 8 mudou para R$ 40,00.',
    'Skol esgotou e foi retirado do pedido.',
  ]);
});

test('carrinho salvo corrompido é descartado', () => {
  assert.deepEqual(sanitizar('lixo'), []);
  assert.equal(sanitizar([{ produtoId: 'x', qtd: 1, preco: 100, chave: 'k' }, { qtd: 'a' }]).length, 1);
});

test('parser de CSV aceita vírgula e aspas dentro de campo', () => {
  const csv = 'id,nome,detalhe,preco\r\nx,"Gin, tônica","diz ""oi""","1.234,50"\nlinha-vazia,,,\n\n';
  const l = parseCSV(csv);
  assert.deepEqual(l[1], ['x', 'Gin, tônica', 'diz "oi"', '1.234,50']);
  const o = csvParaObjetos(csv);
  assert.equal(o[0].nome, 'Gin, tônica');
  assert.equal(parsePreco(o[0].preco), 123450);
});

test('planilha (CSV) monta o catálogo', () => {
  const prod = 'id,categoria,nome,detalhe,preco,disponivel,destaque,ordem,imagem,tags,somente_balcao\n'
    + 'heineken-8,Cervejas,Heineken,lata · pack com 8,"38,00",SIM,Mais pedido,1,,,NÃO\n'
    + 'gin-rocks,combos-gin,Rocks,,70,sim,,2,,,\n';
  const vars = 'produto_id,grupo,nome,preco,disponivel\ngin-rocks,Energético,Red Bull,100,SIM\ngin-rocks,Energético,Bally,,SIM\n';
  const conf = 'campo,valor\nchave_pix,59614773000100\ntaxa_entrega,"5,00"\naviso_do_dia,Heineken em promoção hoje!\naberto_forcado,Fechado\n';
  const m = montarModelo({
    produtos: csvParaObjetos(prod), variantes: csvParaObjetos(vars),
    config: configDeLinhas(csvParaObjetos(conf)), bairros: [],
  }, CONFIG);
  assert.equal(m.porId.get('heineken-8').preco, 3800);
  assert.equal(m.porId.get('heineken-8').destaque, 'mais-pedido');
  assert.equal(m.porId.get('heineken-8').categoria, 'cervejas');
  assert.equal(precoComEscolhas(m.porId.get('gin-rocks'), { 'Energético': 'Bally' }), 7000, 'variante sem preço usa o do produto');
  assert.equal(m.porId.get('gin-rocks').precoMin, 7000, '"a partir de" considera a variante sem preço');
  assert.equal(m.porId.get('gin-rocks').precoMax, 10000);
  assert.equal(m.config.taxa_entrega, 500);
  assert.equal(m.config.aberto_forcado, 'fechado');
  assert.equal(m.config.aviso_do_dia, 'Heineken em promoção hoje!');
});

test('número do pedido', () => {
  const n = gerarNumeroPedido(new Date('2026-11-02T15:00:00Z'), () => 0.4821);
  assert.equal(n, 'KM28-0211-4821');
});

test('mensagem do WhatsApp segue o modelo', () => {
  let c = adicionar([], { produto: P('heineken-8'), qtd: 2 });
  c = adicionar(c, { produto: P('gin-gordons'), escolhas: { 'Energético': 'Red Bull', [SABOR]: 'Tradicional' } });
  c = adicionar(c, { produto: P('coca-2l'), obs: 'bem gelada' });
  const msg = montarMensagem({
    numero: 'KM28-0211-4821', itens: c, categorias: modelo.categorias,
    recebimento: 'entrega', taxa: 500, bairroTaxa: 'Bairro X',
    cliente: { nome: 'João' },
    endereco: { rua: 'Rua Frei Exemplo', numero: '123', complemento: 'ap 12', bairro: 'Bairro X', referencia: 'portão azul' },
    pagamento: 'pix', temAlcool: true,
  });
  assert.equal(msg, [
    '*NOVO PEDIDO · ADEGA KM28*',
    'Pedido: KM28-0211-4821',
    '',
    '*Itens*',
    '2x Heineken lata · pack com 8 — R$ 76,00',
    "1x Combo Gordon's Tradicional (Red Bull Tradicional) — R$ 130,00",
    '1x Coca-Cola 2 L — R$ 15,00',
    '   obs: bem gelada',
    '',
    'Subtotal: R$ 221,00',
    'Entrega (Bairro X): R$ 5,00',
    '*TOTAL: R$ 226,00*',
    '',
    '*Receber:* Entrega',
    'Rua Frei Exemplo, 123 — ap 12 — Bairro X',
    'Ref.: portão azul',
    '',
    '*Pagamento:* Pix (vou pagar após a confirmação do pedido)',
    '*Cliente:* João',
    '',
    'Confirmo ter 18 anos ou mais.',
  ].join('\n'));
});

test('retirada + dinheiro com troco; entrega a combinar', () => {
  const c = adicionar([], { produto: P('skol-15') });
  const r = montarMensagem({ numero: 'X', itens: c, categorias: modelo.categorias, recebimento: 'retirada',
    taxa: null, cliente: { nome: 'Ana' }, pagamento: 'dinheiro', troco: 5000 });
  assert.ok(r.includes('*Receber:* Retirada no balcão'));
  assert.ok(r.includes('*TOTAL: R$ 43,00*'));
  assert.ok(r.includes('Dinheiro — troco para R$ 50,00'));
  assert.ok(!r.includes('18 anos'));
  const e = montarMensagem({ numero: 'X', itens: c, categorias: modelo.categorias, recebimento: 'entrega',
    taxa: null, cliente: { nome: 'Ana' }, endereco: { rua: 'R', numero: '1' }, pagamento: 'credito' });
  assert.ok(e.includes('Entrega: a combinar'));
  assert.ok(e.includes('*TOTAL: R$ 43,00 + entrega*'));
});

test('energético: sabor obrigatório quando a marca tem sabores', () => {
  const p = P('gin-rocks');
  assert.deepEqual(p.grupos[0].opcoes.find((o) => o.nome === 'Red Bull').sabores, ['Tradicional', 'Melancia', 'Tropical']);
  assert.equal(escolhasValidas(p, { 'Energético': 'Red Bull' }), false, 'sem sabor');
  assert.equal(escolhasValidas(p, { 'Energético': 'Red Bull', [SABOR]: 'Uva' }), false, 'sabor que não existe');
  assert.equal(escolhasValidas(p, { 'Energético': 'Red Bull', [SABOR]: 'Melancia' }), true);
  const c = adicionar([], { produto: p, escolhas: { 'Energético': 'Red Bull', [SABOR]: 'Melancia' } });
  assert.equal(c[0].preco, 10000);
  assert.equal(descricaoItem(c[0], modelo.categorias), 'Combo Rocks (Red Bull Melancia)');
});

test('energético sem lista de sabores (Vibe) não pede sabor', () => {
  const p = P('dose-red-label');
  assert.equal(escolhasValidas(p, { 'Energético': 'Vibe' }), true);
  assert.equal(escolhasValidas(p, { 'Energético': 'Red Bull' }), false);
});

test('sabores vêm da aba config da planilha', () => {
  const m = montarModelo({ ...cru, config: { ...cru.config, sabores_bally: 'Tradicional; Maçã Verde' } }, CONFIG);
  const bally = m.porId.get('gin-rocks').grupos[0].opcoes.find((o) => o.nome === 'Bally');
  assert.deepEqual(bally.sabores, ['Tradicional', 'Maçã Verde']);
});

test('essências: marca → sabor com foto, obrigatório', () => {
  const p = P('essencia-ziggy');
  assert.equal(P('essencia-ziggy-pink-lemonade').destaque, 'novidade', 'Pink Lemonade é a novidade');
  const sabores = p.grupos[0].opcoes;
  assert.equal(sabores.length, 20);
  assert.equal(sabores[0].nome, 'Pink Lemonade');
  assert.ok(sabores.every((o) => o.imagem.startsWith('assets/img/')), 'cada sabor tem foto');
  assert.throws(() => adicionar([], { produto: p }));
  const c = adicionar([], { produto: p, escolhas: { Sabor: 'Watermelon Bomb' } });
  assert.equal(descricaoItem(c[0], modelo.categorias), 'Essência Ziggy (Watermelon Bomb)');
  assert.equal(modelo.categorias.find((x) => x.id === 'narguile').alcool, true, 'só para 18+');
  assert.deepEqual(modelo.categorias.find((x) => x.id === 'narguile').produtos.slice(0, 3).map((x) => x.id), ['essencia-ziggy-pink-lemonade', 'essencia-ziggy', 'essencia-onix'], 'essências primeiro');
});

test('carvão de narguilé: unidade ou caixa, preço de cada', () => {
  const p = P('carvao-narguile');
  assert.equal(precoComEscolhas(p, { Quantidade: 'Unidade' }), 150);
  assert.equal(precoComEscolhas(p, { Quantidade: 'Caixa' }), 2500);
  assert.equal(descricaoItem(adicionar([], { produto: p, escolhas: { Quantidade: 'Caixa' } })[0], modelo.categorias), 'Carvão para narguilé (Caixa)');
});

test('mostrar_tabaco = NÃO esconde essências e cigarros (e tira do carrinho)', () => {
  const m = montarModelo({ ...cru, config: { ...cru.config, mostrar_tabaco: 'NÃO' } }, CONFIG);
  const ids = m.categorias.map((c) => c.id);
  assert.ok(!ids.includes('cigarros'));
  assert.ok(ids.includes('narguile'), 'acessórios continuam');
  assert.equal(m.porId.get('essencia-ziggy'), undefined, 'essências somem');
  assert.ok(m.porId.get('carvao-narguile'), 'carvão continua');
  assert.equal(m.porId.get('cig-marlboro'), undefined);
  const c = adicionar([], { produto: P('cig-marlboro') });
  assert.equal(revalidar(c, m).itens.length, 0);
});

test('narguilé: sub-abas Essências · Acessórios · Narguilé', async () => {
  const { htmlCatalogo } = await import('../js/render.js');
  const cat = modelo.categorias.find((c) => c.id === 'narguile');
  const grupos = (s) => cat.produtos.filter((p) => p.subgrupo === s).map((p) => p.id);
  assert.deepEqual(grupos('Acessórios'), ['carvao-narguile', 'aluminio-narguile']);
  assert.deepEqual(grupos('Narguilé'), ['narguile-completo', 'rosh', 'abafador']);
  const { lista } = htmlCatalogo([cat]);
  for (const s of ['Essências', 'Acessórios', 'Narguilé']) assert.ok(lista.includes('data-subaba="' + s + '"'), s);
});

test('taxa de entrega por bairro (sem acento, sem maiúscula)', () => {
  const t = (bairro, recebimento = 'entrega') => calcularTaxa({ recebimento, bairro }, modelo.config, modelo.bairros).taxa;
  assert.equal(t('Jardim São Rafael'), 200);
  assert.equal(t('jardim sao rafael'), 200);
  assert.equal(t('Jardim Guanabara'), 400);
  assert.equal(t('Centro'), null, 'fora da tabela: a combinar');
  assert.equal(t('Centro', 'retirada'), 0);
});

test('pedido grande (25 itens) gera link válido', () => {
  let c = [];
  for (const p of modelo.produtos.filter((x) => !x.grupos.length).slice(0, 25)) {
    c = adicionar(c, { produto: p, obs: 'bem gelada por favor' });
  }
  const msg = montarMensagem({ numero: 'KM28-0211-0001', itens: c, categorias: modelo.categorias, recebimento: 'entrega',
    taxa: null, cliente: { nome: 'Teste' }, endereco: { rua: 'Rua A', numero: '1' }, pagamento: 'pix', temAlcool: true });
  const url = linkWhatsApp('5511915817410', msg);
  assert.ok(url.startsWith('https://wa.me/5511915817410?text='));
  assert.equal(decodeURIComponent(url.split('text=')[1]), msg);
  assert.ok(url.length < 8000, `URL com ${url.length} caracteres`);
});
