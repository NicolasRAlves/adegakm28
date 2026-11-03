// Testa os fluxos completos no Chrome (sem abrir o WhatsApp de verdade) e tira prints.
// Uso: node ferramentas/testar-fluxos.mjs   → prints em ferramentas/prints/
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { abrirChrome } from './chrome.mjs';
import { iniciarServidor } from './servidor.mjs';
import { crc16 } from '../site/js/pix.js';

const PORTA = 8765;
const BASE = `http://localhost:${PORTA}/`;
const PRINTS = fileURLToPath(new URL('./prints/', import.meta.url));
mkdirSync(PRINTS, { recursive: true });
const CATALOGO = JSON.parse(readFileSync(new URL('../site/data/catalogo.json', import.meta.url), 'utf8'));

const srv = await iniciarServidor(PORTA);
const c = await abrirChrome();
await c.send('Network.enable');
await c.send('Network.setBypassServiceWorker', { bypass: true });
// não abre o WhatsApp de verdade: guarda a URL para conferir a mensagem
await c.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.open = (u) => { window.__ultimaUrl = u; return null; };' });

// ---- interceptação de arquivos (para simular planilha, preço alterado etc.) ----
let regras = [];
await c.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
c.ouvir(async (d) => {
  if (d.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = d.params;
  const r = regras.find((x) => request.url.includes(x.trecho));
  try {
    if (!r) return await c.send('Fetch.continueRequest', { requestId });
    if (r.falhar) return await c.send('Fetch.failRequest', { requestId, errorReason: 'ConnectionFailed' });
    await c.send('Fetch.fulfillRequest', {
      requestId, responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: r.tipo }, { name: 'Access-Control-Allow-Origin', value: '*' }],
      body: Buffer.from(r.corpo).toString('base64'),
    });
  } catch { /* página recarregou */ }
});

const $ = (sel) => JSON.stringify(sel);
const clicar = (sel) => c.avaliar(`(() => { const e = document.querySelector(${$(sel)}); if (!e) throw new Error('não achei ' + ${$(sel)}); e.click(); return true; })()`);
const texto = (sel) => c.avaliar(`document.querySelector(${$(sel)})?.innerText ?? null`);
const existe = (sel) => c.avaliar(`!!document.querySelector(${$(sel)})`);
const visivel = (sel) => c.avaliar(`(() => { const e = document.querySelector(${$(sel)}); return !!e && !!(e.offsetWidth || e.offsetHeight) && getComputedStyle(e).visibility !== 'hidden'; })()`);
const digitar = (sel, v) => c.avaliar(`(() => { const e = document.querySelector(${$(sel)}); e.value = ${$(v)}; e.dispatchEvent(new Event('input', {bubbles:true})); e.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
const marcar = (sel) => c.avaliar(`(() => { const e = document.querySelector(${$(sel)}); e.checked = true; e.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
const foto = (nome) => c.foto(join(PRINTS, `${nome}.png`));
const pausa = (ms = 250) => c.espera(ms);

async function novaVisita({ limpar = true, idade = '18' } = {}) {
  await c.ir(BASE);
  await c.avaliar(`(() => { ${limpar ? 'localStorage.clear();' : ''} ${idade ? `localStorage.setItem('km28.idade', '"${idade}"');` : ''} return true; })()`);
  await c.ir(BASE);
  await c.avaliar(`window.open = (u) => { window.__ultimaUrl = u; return null; }; true`);
  await pausa(300);
}
async function mensagemEnviada() {
  const url = await c.avaliar('window.__ultimaUrl');
  assert.ok(url?.startsWith('https://wa.me/5511915817410?text='), `abriu o WhatsApp: ${url}`);
  return decodeURIComponent(url.split('text=')[1]);
}
const ok = (nome) => console.log(`✔ ${nome}`);

try {
  // ======== 1. Portão de idade (celular 360) ========
  await c.tela(360, 760, { escala: 2, movel: true });
  await c.ir(BASE);
  await c.avaliar('localStorage.clear(); true');
  await c.ir(BASE);
  assert.ok(await c.avaliar('document.querySelector("#dlg-idade").open'), 'portão aberto na primeira visita');
  await foto('01-portao-idade-360');
  await clicar('#idade-nao');
  await pausa();
  await foto('02-portao-menor-360');
  await clicar('#dlg-idade [data-acao="fechar"]');
  await pausa();
  const catsMenor = await c.avaliar('[...document.querySelectorAll(".secao")].map(s => s.id)');
  assert.deepEqual(catsMenor, ['refrigerantes', 'agua', 'mercearia'], 'menor vê só itens sem álcool');
  ok('portão de idade: "Não" mostra só refrigerantes');
  await c.avaliar('localStorage.clear(); true');
  await c.ir(BASE);
  await clicar('#idade-sim');
  await pausa();
  assert.equal(await c.avaliar('localStorage.getItem("km28.idade")'), '"18"');
  ok('portão de idade: "Sim" guarda a resposta');
  await foto('03-inicio-360');

  // ======== 2. Lista, busca e abas ========
  const cats = await c.avaliar('[...document.querySelectorAll(".secao")].map(s => s.id)');
  assert.deepEqual(cats, ['destaques', 'cervejas', 'combos-whisky', 'combos-gin', 'doses-whisky', 'narguile', 'cigarros', 'refrigerantes', 'agua', 'mercearia']);
  await digitar('#busca', 'heine');
  const achados = await c.avaliar('[...document.querySelectorAll(".secao:not([hidden]) .item:not([hidden])")].map(i => i.dataset.id)');
  assert.deepEqual(achados, ['heineken-8', 'heineken-zero-8', 'heineken-ln-6', 'heineken-zero-ln-6']);
  await digitar('#busca', 'acucar');
  assert.deepEqual(await c.avaliar('[...document.querySelectorAll(".secao:not([hidden]) .item:not([hidden])")].map(i => i.dataset.id)'), ['coca-zero-2l']);
  await digitar('#busca', 'xyzxyz');
  assert.ok(await visivel('#vazio-busca'));
  await digitar('#busca', '');
  ok('busca ignora acentos ("heine", "acucar")');
  const largura = await c.avaliar('document.documentElement.scrollWidth');
  assert.equal(largura, 360, 'sem scroll horizontal em 360 px');
  ok('360 px sem scroll horizontal');

  // ======== 3. Carrinho: simples, stepper, combos ========
  await clicar('.item[data-id="heineken-8"] [data-acao="mais"]');
  await clicar('.item[data-id="heineken-8"] [data-acao="mais"]');
  assert.equal(await texto('.item[data-id="heineken-8"] output'), '2', 'stepper na linha');
  assert.ok(await visivel('#barra-carrinho'));
  assert.equal(await texto('#barra-txt'), '2 itens · R$ 76,00');
  ok('stepper na linha + barra do carrinho');

  await clicar('.item[data-id="gin-rocks"] [data-acao="mais"]');
  await pausa(350);
  assert.ok(await c.avaliar('document.querySelector("#dlg-produto").open'));
  assert.equal(await texto('#s-add'), 'Escolha: Energético');
  await clicar('#s-add');
  assert.match(await texto('#s-erro'), /Escolha uma opção/);
  await clicar('label[for="op-0-0"]'); // Red Bull
  assert.equal(await texto('#s-add'), 'Adicionar · R$ 100,00');
  // sabor do energético aparece já com "Tradicional" marcado
  assert.match(await texto('#grupo-sabor legend'), /Sabor do Red Bull/);
  assert.ok(await c.avaliar('document.querySelector("#op-sabor-0").checked'), 'Tradicional marcado');
  await clicar('label[for="op-sabor-1"]'); // Melancia
  await foto('04-sheet-rocks-360');
  await clicar('#s-add');
  await pausa(300);
  await clicar('.item[data-id="gin-rocks"] [data-acao="mais"]');
  await pausa(300);
  await clicar('label[for="op-0-1"]'); // Bally
  assert.equal(await texto('#s-add'), 'Adicionar · R$ 70,00');
  await clicar('#s-add');
  await pausa(300);
  ok('Rocks: Red Bull R$ 100 / Bally R$ 70');

  await clicar('.item[data-id="gin-gordons"] [data-acao="mais"]');
  await pausa(300);
  assert.equal(await texto('#s-add'), 'Adicionar · R$ 130,00', 'premium: mesmo preço antes da escolha');
  await clicar('label[for="op-0-0"]');
  await digitar('#s-obs', 'bem gelada');
  await clicar('[data-acao="s-mais"]');
  assert.equal(await texto('#s-add'), 'Adicionar · R$ 260,00');
  await clicar('#s-add');
  await pausa(300);
  ok('combo premium com observação e quantidade');

  await clicar('.item[data-id="cw-black-label"] [data-acao="mais"]');
  await pausa(300);
  await clicar('label[for="op-0-1"]'); // saco de gelo
  await clicar('#s-add');
  await pausa(300);
  await clicar('.item[data-id="refri-lata"] [data-acao="mais"]');
  await pausa(300);
  await clicar('label[for="op-0-0"]');
  await clicar('#s-add');
  await pausa(300);
  await foto('05-lista-com-itens-360');

  await clicar('#abrir-carrinho');
  await pausa(350);
  assert.ok(await c.avaliar('document.querySelector("#dlg-carrinho").open'));
  await foto('06-carrinho-360');
  // limpar com confirmação na própria tela
  await clicar('#dlg-carrinho [data-acao="limpar"]');
  assert.ok(await existe('#dlg-carrinho [data-acao="limpar-sim"]'));
  await clicar('#dlg-carrinho [data-acao="limpar-nao"]');
  ok('limpar carrinho pede confirmação na interface');
  const subtotalTxt = await texto('#dlg-carrinho .c-subtotal .preco');
  assert.equal(subtotalTxt, 'R$ 731,00'); // 76 + 100 + 70 + 260 + 220 + 5
  ok(`subtotal ${subtotalTxt}`);

  // ======== 4. Checkout: entrega + Pix ========
  await clicar('#dlg-carrinho [data-acao="finalizar"]');
  await pausa(350);
  await clicar('#form-checkout button[type="submit"]');
  await pausa(200);
  assert.match(await texto('#erro-nome'), /nome/);
  assert.equal(await c.avaliar('document.activeElement.id'), 'ck-nome', 'foco no primeiro erro');
  await foto('07-checkout-erros-360');
  ok('validação com foco no primeiro erro');
  await digitar('#ck-nome', 'João Teste');
  // CEP primeiro → rua e bairro aparecem sozinhos (travados) → taxa do bairro
  assert.ok(await c.avaliar('document.querySelector("#ck-rua").readOnly && document.querySelector("#ck-bairro").readOnly'), 'rua e bairro não são digitáveis');
  await digitar('#ck-cep', '04860050');
  for (let i = 0; i < 30 && !(await c.avaliar('document.querySelector("#ck-rua").value')); i++) await pausa(200);
  assert.equal(await c.avaliar('document.querySelector("#ck-cep").value'), '04860-050', 'máscara do CEP');
  assert.equal(await c.avaliar('document.querySelector("#ck-rua").value'), 'Rua Frei Amador Arrais');
  assert.equal(await c.avaliar('document.querySelector("#ck-bairro").value'), 'Jardim São Rafael');
  assert.ok(await c.avaliar('document.querySelector("#ck-rua").readOnly'), 'rua continua travada');
  assert.equal(await c.avaliar('document.activeElement.id'), 'ck-numero', 'foco vai para o número');
  assert.match(await texto('#ck-taxa-info'), /Jardim São Rafael: R\$ 2,00/);
  await foto('07b-checkout-cep-360');
  ok('CEP → rua e bairro automáticos + taxa do bairro (R$ 2,00)');
  await digitar('#ck-numero', '123');
  await digitar('#ck-complemento', 'ap 12');
  await digitar('#ck-referencia', 'portão azul');
  await marcar('#pg-pix');
  await marcar('#ck-maior');
  await pausa(150);
  assert.ok(await visivel('#ck-pix-info'), 'aviso de aguardar confirmação antes de pagar');
  await foto('08-checkout-pix-360');
  await clicar('#form-checkout button[type="submit"]');
  await pausa(400);
  let msg = await mensagemEnviada();
  console.log(`\n----- mensagem (entrega + Pix) -----\n${msg}\n------------------------------------`);
  assert.match(msg, /^\*NOVO PEDIDO · ADEGA KM28\*\nPedido: KM28-\d{4}-\d{4}\n/);
  assert.ok(msg.includes('2x Heineken lata · pack com 8 — R$ 76,00'));
  assert.ok(msg.includes('1x Combo Rocks (Red Bull Melancia) — R$ 100,00'));
  assert.ok(msg.includes('1x Combo Rocks (Bally Tradicional) — R$ 70,00'));
  assert.ok(msg.includes("2x Combo Gordon's Tradicional (Red Bull Tradicional) — R$ 260,00\n   obs: bem gelada"));
  assert.ok(msg.includes('1x Combo Black Label (1 saco de gelo 5 kg, Red Bull Tradicional) — R$ 220,00'));
  assert.ok(msg.includes('Entrega (Jardim São Rafael): R$ 2,00'));
  assert.ok(msg.includes('*TOTAL: R$ 733,00*'));
  assert.ok(msg.includes('Rua Frei Amador Arrais, 123 — ap 12 — Jardim São Rafael\nCEP 04860-050\nRef.: portão azul'));
  assert.ok(msg.includes('*Pagamento:* Pix (vou pagar após a confirmação do pedido)'));
  assert.ok(msg.includes('Confirmo ter 18 anos ou mais.'));
  assert.ok(await c.avaliar('document.querySelector("#dlg-enviado").open'));
  assert.match(await texto('#enviado'), /Aguarde a confirmação dos itens no WhatsApp antes de pagar/);
  assert.match(await texto('#enviado'), /59\.614\.773\/0001-00/);
  const brcode = await c.avaliar('document.querySelector("#pix-codigo").value');
  assert.ok(brcode.includes('5406733.00'), 'taxa do bairro conhecida → Copia e Cola com o total');
  assert.equal(crc16(brcode.slice(0, -4)), brcode.slice(-4), 'CRC do Copia e Cola confere');
  await foto('09-enviado-pix-360');
  await c.avaliar('document.querySelector("#enviado details").open = true; true');
  await pausa(600);
  assert.ok(await existe('#qr svg'), 'QR Code do Pix gerado');
  ok('entrega + Pix: mensagem, chave, Copia e Cola e QR');
  assert.equal(await c.avaliar('JSON.parse(localStorage.getItem("km28.carrinho")).length'), 0, 'carrinho limpo após enviar');
  await clicar('[data-acao="novo-pedido"]');
  await pausa(200);
  assert.ok(await visivel('#repetir-ultimo'), 'botão repetir último pedido');
  ok('repetir último pedido aparece');

  // ======== 5. Retirada + dinheiro com troco ========
  await clicar('.item[data-id="skol-15"] [data-acao="mais"]');
  await clicar('#abrir-carrinho');
  await pausa(300);
  await clicar('#dlg-carrinho [data-acao="finalizar"]');
  await pausa(300);
  assert.equal(await c.avaliar('document.querySelector("#ck-nome").value'), 'João Teste', 'lembrou o nome');
  await marcar('#rc-retirada');
  await marcar('#pg-dinheiro');
  await digitar('#ck-troco-valor', '20');
  await marcar('#ck-maior');
  await clicar('#form-checkout button[type="submit"]');
  await pausa(200);
  assert.match(await texto('#erro-troco'), /R\$ 43,00 ou mais/);
  await digitar('#ck-troco-valor', '50,00');
  await c.avaliar('document.querySelector("#ck-resumo").scrollIntoView({block:"center"}); true');
  await foto('10-checkout-retirada-dinheiro-360');
  assert.ok(await c.avaliar('(() => { const m = document.querySelector("#form-checkout .tela-meio"); return m.scrollWidth <= m.clientWidth; })()'), 'checkout sem scroll horizontal');
  assert.ok(await c.avaliar('document.querySelector("#ck-resumo").getBoundingClientRect().right <= innerWidth'), 'resumo visível na largura da tela');
  await clicar('#form-checkout button[type="submit"]');
  await pausa(400);
  msg = await mensagemEnviada();
  assert.ok(msg.includes('*Receber:* Retirada no balcão'));
  assert.ok(msg.includes('*TOTAL: R$ 43,00*'));
  assert.ok(msg.includes('*Pagamento:* Dinheiro — troco para R$ 50,00'));
  assert.ok(!msg.includes('Entrega'));
  ok('retirada + dinheiro com troco (valida troco ≥ total)');
  await clicar('[data-acao="novo-pedido"]');

  // ======== 6. Entrega + cartão ========
  await clicar('.item[data-id="coca-2l"] [data-acao="mais"]');
  await clicar('#abrir-carrinho');
  await pausa(300);
  await clicar('#dlg-carrinho [data-acao="finalizar"]');
  await pausa(300);
  assert.ok(!(await existe('#ck-maior')), 'só refrigerante: sem checkbox 18+');
  await marcar('#pg-credito');
  await clicar('#form-checkout button[type="submit"]');
  await pausa(400);
  msg = await mensagemEnviada();
  assert.ok(msg.includes('*Pagamento:* Cartão de crédito na entrega'));
  assert.ok(!msg.includes('18 anos'));
  assert.ok(!(await texto('#enviado')).includes('Chave Pix'));
  ok('entrega + cartão');
  await clicar('[data-acao="novo-pedido"]');

  // ======== 7. Esgotado não adiciona + preço alterado avisa ========
  await clicar('.item[data-id="heineken-8"] [data-acao="mais"]');
  await clicar('.item[data-id="skol-15"] [data-acao="mais"]');
  const alterado = structuredClone(CATALOGO);
  alterado.produtos.find((p) => p.id === 'heineken-8').preco = 4000;
  alterado.produtos.find((p) => p.id === 'skol-15').disponivel = false;
  alterado.variantes.find((v) => v.produto_id === 'gin-rocks' && v.nome === 'Red Bull').disponivel = false;
  regras = [{ trecho: 'data/catalogo.json', tipo: 'application/json', corpo: JSON.stringify(alterado) }];
  await c.ir(BASE);
  await pausa(400);
  assert.ok(await existe('.item[data-id="skol-15"].esgotado'));
  assert.ok(!(await existe('.item[data-id="skol-15"] [data-acao="mais"]')), 'esgotado sem botão');
  await clicar('#abrir-carrinho');
  await pausa(300);
  const avisos = await texto('#dlg-carrinho .c-avisos');
  assert.match(avisos, /O preço de Heineken lata · pack com 8 mudou para R\$ 40,00/);
  assert.match(avisos, /Skol esgotou e foi retirado do pedido/);
  await foto('11-carrinho-avisos-360');
  await clicar('#dlg-carrinho [data-acao="fechar"]');
  await clicar('.item[data-id="gin-rocks"] [data-acao="mais"]');
  await pausa(300);
  assert.ok(await c.avaliar('document.querySelector("#op-0-0").disabled'), 'variante esgotada desabilitada');
  await clicar('#dlg-produto [data-acao="fechar"]');
  ok('esgotado não adiciona; preço alterado gera aviso no carrinho');

  // ======== 8. Planilha publicada (CSV) e planilha fora do ar ========
  const configComPlanilha = readFileSync(new URL('../site/data/config.js', import.meta.url), 'utf8')
    .replace("produtos: '',", "produtos: 'https://docs.google.com/fake/produtos.csv',")
    .replace("variantes: '',", "variantes: 'https://docs.google.com/fake/variantes.csv',")
    .replace("config: '',", "config: 'https://docs.google.com/fake/config.csv',");
  const csvProdutos = 'id,categoria,nome,detalhe,preco,disponivel,destaque,ordem,imagem,tags,somente_balcao\n'
    + 'heineken-8,cervejas,Heineken,lata · pack com 8,"36,00",SIM,Promo,1,,,NÃO\n'
    + 'gin-rocks,combos-gin,Rocks,gelo de coco + energético,70,SIM,,2,,,\n';
  const csvVariantes = 'produto_id,grupo,nome,preco,disponivel\ngin-rocks,Energético,Red Bull,100,SIM\ngin-rocks,Energético,Bally,,SIM\n';
  const csvConfig = 'campo,valor\nchave_pix,59614773000100\ntipo_chave,CNPJ\nnome_recebedor,KM28 COMERCIO DE BEBIDAS LTDA\ncidade_pix,SAO PAULO\ntaxa_entrega,"5,00"\naviso_do_dia,Heineken em promoção hoje!\n';
  regras = [
    { trecho: 'data/config.js', tipo: 'text/javascript', corpo: configComPlanilha },
    { trecho: 'fake/produtos.csv', tipo: 'text/csv', corpo: csvProdutos },
    { trecho: 'fake/variantes.csv', tipo: 'text/csv', corpo: csvVariantes },
    { trecho: 'fake/config.csv', tipo: 'text/csv', corpo: csvConfig },
  ];
  await novaVisita();
  await pausa(500);
  assert.equal(await texto('#aviso-dia-txt'), 'Heineken em promoção hoje!');
  assert.deepEqual(await c.avaliar('[...document.querySelectorAll(".secao")].map(s => s.id)'), ['destaques', 'cervejas', 'combos-gin']);
  assert.match(await texto('#p-heineken-8'), /R\$ 36,00/);
  assert.match(await texto('#origem'), /Preços atualizados agora/);
  await foto('12-planilha-aviso-destaques-360');
  ok('planilha CSV: preços, aviso do dia, destaques');
  // pedido com taxa fixa → Pix com valor
  await clicar('#p-heineken-8 [data-acao="mais"]');
  await clicar('#abrir-carrinho');
  await pausa(300);
  await clicar('#dlg-carrinho [data-acao="finalizar"]');
  await pausa(300);
  await digitar('#ck-nome', 'Ana');
  assert.ok(await c.avaliar('document.querySelector("#ck-numero").disabled'), 'número bloqueado até o CEP');
  await digitar('#ck-cep', '04860050');
  for (let i = 0; i < 30 && await c.avaliar('document.querySelector("#ck-numero").disabled'); i++) await pausa(200);
  assert.ok(!(await c.avaliar('document.querySelector("#ck-numero").disabled')), 'número liberado depois do CEP');
  await digitar('#ck-numero', '10');
  await marcar('#pg-pix');
  await marcar('#ck-maior');
  await clicar('#form-checkout button[type="submit"]');
  await pausa(400);
  msg = await mensagemEnviada();
  assert.ok(msg.includes('Entrega: R$ 5,00'));
  assert.ok(msg.includes('*TOTAL: R$ 41,00*'));
  const brcode2 = await c.avaliar('document.querySelector("#pix-codigo").value');
  assert.ok(brcode2.includes('540541.00'), 'Copia e Cola com o valor do pedido');
  assert.ok(brcode2.includes('011459614773000100'));
  assert.equal(crc16(brcode2.slice(0, -4)), brcode2.slice(-4));
  assert.match(await texto('[data-acao="copiar-pix"]'), /R\$ 41,00/);
  await foto('13-enviado-pix-com-valor-360');
  console.log(`\nPix Copia e Cola (R$ 41,00): ${brcode2}\n`);
  ok('taxa fixa da planilha → Pix Copia e Cola com valor');
  await clicar('[data-acao="novo-pedido"]');

  // planilha fora do ar → catálogo local
  regras = [
    { trecho: 'data/config.js', tipo: 'text/javascript', corpo: configComPlanilha },
    { trecho: 'docs.google.com', falhar: true },
  ];
  await novaVisita();
  await pausa(600);
  assert.deepEqual(await c.avaliar('[...document.querySelectorAll(".secao")].map(s => s.id)'), ['destaques', 'cervejas', 'combos-whisky', 'combos-gin', 'doses-whisky', 'narguile', 'cigarros', 'refrigerantes', 'agua', 'mercearia']);
  assert.match(await texto('#origem'), /Catálogo local/);
  ok('planilha fora do ar → usa o catálogo local');
  regras = [];

  // ======== 9. Pedido grande ========
  await novaVisita();
  const ids = CATALOGO.produtos.filter((p) => !CATALOGO.variantes.some((v) => v.produto_id === p.id)).map((p) => p.id);
  for (const id of ids) await clicar(`#p-${id} [data-acao="mais"]`);
  await clicar('#abrir-carrinho');
  await pausa(300);
  await clicar('#dlg-carrinho [data-acao="finalizar"]');
  await pausa(300);
  await digitar('#ck-nome', 'Teste Grande');
  // "Não sei meu CEP": digita a rua e escolhe a sugestão do ViaCEP
  await clicar('[data-acao="sem-cep"]');
  assert.ok(!(await c.avaliar('document.querySelector("#ck-rua").readOnly')), 'rua liberada');
  await digitar('#ck-rua', 'Frei Amador');
  for (let i = 0; i < 30 && !(await visivel('#ck-rua-sug button')); i++) await pausa(200);
  assert.ok(await visivel('#ck-rua-sug button'), 'sugestões de rua apareceram');
  await foto('07c-checkout-sem-cep-360');
  await clicar('#ck-rua-sug button');
  await pausa(150);
  assert.equal(await c.avaliar('document.querySelector("#ck-cep").value'), '04860-050');
  assert.equal(await c.avaliar('document.querySelector("#ck-bairro").value'), 'Jardim São Rafael');
  ok('"Não sei meu CEP" → busca pela rua completa CEP e bairro');
  await digitar('#ck-numero', '999');
  await marcar('#pg-pix');
  await marcar('#ck-maior');
  await clicar('#form-checkout button[type="submit"]');
  await pausa(400);
  const urlGrande = await c.avaliar('window.__ultimaUrl');
  msg = await mensagemEnviada();
  assert.equal(msg.split('\n').filter((l) => /^\d+x /.test(l)).length, ids.length);
  ok(`pedido com ${ids.length} itens: URL de ${urlGrande.length} caracteres`);

  // ======== 10. Prints em outras larguras ========
  await novaVisita();
  await clicar('#p-heineken-8 [data-acao="mais"]');
  await clicar('#p-corona-ln-6 [data-acao="mais"]');
  for (const [nome, w, h, movel] of [['430', 430, 900, true], ['768-tablet', 768, 1024, true], ['1280-desktop', 1280, 800, false]]) {
    await c.tela(w, h, { escala: 1, movel });
    await c.ir(BASE);
    await pausa(300);
    assert.equal(await c.avaliar('document.documentElement.scrollWidth'), w, `sem scroll horizontal em ${w}`);
    await foto(`20-inicio-${nome}`);
  }
  ok('430, 768 e 1280 sem scroll horizontal');
  // desktop: carrinho lateral
  assert.ok(await visivel('#carrinho-lateral'));
  assert.ok(!(await visivel('#barra-carrinho')));
  await c.avaliar('document.querySelector("#lista").className = "lista modo-grade"; true');
  await foto('21-grade-1280');
  await c.tela(360, 760, { escala: 2, movel: true });
  await c.ir(BASE);
  await clicar('#alternar-modo');
  await pausa(200);
  await foto('22-grade-360');
  await clicar('#alternar-modo');
  ok('modo grade');

  // ======== 11. Essências: marca → sabores com foto ========
  await clicar('#p-essencia-ziggy [data-acao="mais"]');
  await pausa(400);
  assert.equal(await c.avaliar('document.querySelectorAll("#dlg-produto .opcoes.com-fotos img").length'), 20, 'cada sabor com foto');
  await clicar('label[for="op-0-0"]'); // Pink Lemonade
  await pausa(400);
  await foto('23-essencias-sabores-360');
  await clicar('#s-add');
  await pausa(300);
  await clicar('#abrir-carrinho');
  await pausa(300);
  assert.match(await texto('#dlg-carrinho .c-itens'), /Essência Ziggy \(Pink Lemonade\)/);
  await clicar('#dlg-carrinho [data-acao="fechar"]');
  ok('essências: sabores com foto e nome');
  await c.avaliar('document.querySelector("#narguile").scrollIntoView(); true');
  await pausa(500);
  await foto('25-narguile-essencias-360');
  await clicar('#narguile .subaba[data-subaba="Acessórios"]');
  await pausa(200);
  const visiveisSub = await c.avaliar('[...document.querySelectorAll("#narguile .item")].filter((i) => i.offsetParent).map((i) => i.dataset.id)');
  assert.deepEqual(visiveisSub, ['carvao-narguile', 'aluminio-narguile']);
  await foto('26-subaba-acessorios-360');
  await clicar('#narguile .subaba[data-subaba=""]');
  ok('sub-abas do narguilé filtram os itens');
  await c.avaliar('document.querySelector("#mercearia").scrollIntoView(); true');
  await pausa(500);
  await foto('24-aguas-mercearia-360');

  const erros = c.console.filter((m) => m.startsWith('EXCEÇÃO') || m.startsWith('error'));
  if (erros.length) { console.log('\nErros no console:\n' + erros.join('\n')); process.exitCode = 1; }
  console.log('\nTodos os fluxos passaram. Prints em ferramentas/prints/');
} catch (e) {
  console.error('\n✘ FALHOU:', e.message);
  try { await foto('zz-falha'); } catch { /* sem print */ }
  console.log(c.console.slice(-10).join('\n'));
  process.exitCode = 1;
} finally {
  await c.fechar();
  srv.close();
}
