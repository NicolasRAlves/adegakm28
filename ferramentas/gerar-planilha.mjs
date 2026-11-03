// Gera site/extras/modelo-catalogo.xlsx a partir de site/data/catalogo.json.
// Abas: produtos, variantes, config, bairros, LEIA-ME. Sem dependências (zip feito à mão).
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';

const cat = JSON.parse(readFileSync(new URL('../site/data/catalogo.json', import.meta.url), 'utf8'));
const SAIDA = new URL('../site/extras/modelo-catalogo.xlsx', import.meta.url);

const reais = (c) => (c === null || c === undefined || c === '' ? '' : c / 100);
const simNao = (b) => (b ? 'SIM' : 'NÃO');
const DESTAQUE = { 'mais-pedido': 'Mais pedido', promo: 'Promo', novidade: 'Novidade' };

const abas = [
  {
    nome: 'produtos',
    larguras: [22, 16, 30, 34, 10, 11, 13, 8, 24, 22, 15, 14],
    linhas: [
      ['id', 'categoria', 'nome', 'detalhe', 'preco', 'disponivel', 'destaque', 'ordem', 'imagem', 'tags', 'somente_balcao', 'subgrupo'],
      ...cat.produtos.map((p) => [p.id, p.categoria, p.nome, p.detalhe, reais(p.preco), simNao(p.disponivel), DESTAQUE[p.destaque] || '', p.ordem, p.imagem, p.tags.join(', '), simNao(p.somente_balcao), p.subgrupo || '']),
    ],
    moeda: [4],
    listas: { F: 'SIM,NÃO', K: 'SIM,NÃO', G: 'Novidade,Mais pedido,Promo' },
  },
  {
    nome: 'variantes',
    larguras: [22, 14, 24, 10, 11, 34],
    linhas: [
      ['produto_id', 'grupo', 'nome', 'preco', 'disponivel', 'imagem'],
      ...cat.variantes.map((v) => [v.produto_id, v.grupo, v.nome, reais(v.preco), simNao(v.disponivel), v.imagem || '']),
    ],
    moeda: [3],
    listas: { E: 'SIM,NÃO' },
  },
  {
    nome: 'config',
    larguras: [18, 44, 70],
    linhas: [
      ['campo', 'valor', 'o que é'],
      ['chave_pix', cat.config.chave_pix, 'Chave Pix (CNPJ só com números, telefone com DDD, e-mail ou chave aleatória)'],
      ['tipo_chave', cat.config.tipo_chave, 'CNPJ, CPF, telefone, email ou aleatoria'],
      ['nome_recebedor', cat.config.nome_recebedor, 'Nome que aparece no Pix'],
      ['cidade_pix', cat.config.cidade_pix, 'Cidade do recebedor, sem acento'],
      ['banco', cat.config.banco, 'Banco (opcional, só para mostrar ao cliente)'],
      ['whatsapp', cat.config.whatsapp, 'Número que recebe os pedidos: 55 + DDD + número'],
      ['taxa_entrega', cat.config.taxa_entrega, 'Taxa fixa. Vazio = "a combinar". Se a aba bairros tiver linhas, ela vale.'],
      ['pedido_minimo', cat.config.pedido_minimo, 'Valor mínimo do pedido. Vazio = sem mínimo.'],
      ['aviso_do_dia', cat.config.aviso_do_dia, 'Faixa amarela no topo. Ex.: Heineken em promoção hoje! Vazio = sem faixa.'],
      ['aberto_forcado', cat.config.aberto_forcado, 'auto (segue o horário), aberto ou fechado (feriado, imprevisto)'],
      ['retirada', cat.config.retirada, 'SIM = mostra a opção "Retirada no balcão"'],
      ['pagamentos', cat.config.pagamentos, 'Formas aceitas, separadas por vírgula: pix, credito, debito, dinheiro'],
      ['sabores_red_bull', cat.config.sabores_red_bull, 'Sabores do Red Bull, separados por vírgula. Apague um sabor quando acabar.'],
      ['sabores_bally', cat.config.sabores_bally, 'Sabores do Bally, separados por vírgula.'],
      ['sabores_vibe', cat.config.sabores_vibe, 'Sabores do Vibe (vazio = não pergunta sabor).'],
      ['mostrar_tabaco', cat.config.mostrar_tabaco, 'SIM = mostra essências e cigarros. NÃO = esconde as duas categorias na hora.'],
    ],
    listas: { B11: 'auto,aberto,fechado', B12: 'SIM,NÃO', B17: 'SIM,NÃO' },
  },
  {
    nome: 'bairros',
    larguras: [30, 12],
    linhas: [['bairro', 'taxa'], ...cat.bairros.map((b) => [b.bairro, reais(b.taxa)])],
    moeda: [1],
  },
  {
    nome: 'LEIA-ME',
    larguras: [110],
    linhas: [
      ['Como usar esta planilha (Adega KM28)'],
      [''],
      ['1. PREÇO: na aba produtos, mude a coluna preco. Pode digitar 32 ou 32,00.'],
      ['2. ESGOTOU: na coluna disponivel, troque SIM por NÃO. Volta a aparecer quando colocar SIM.'],
      ['3. OPÇÕES (energético, sabor, gin, gelo): ficam na aba variantes. Preço vazio = usa o preço do produto.'],
      ['   Ex.: Rocks com Red Bull custa 100 e com Bally custa 70: cada variante tem o próprio preço.'],
      ['4. DESTAQUE: escreva Mais pedido ou Promo na coluna destaque. O item aparece na aba Destaques.'],
      ['5. AVISO DO DIA: na aba config, linha aviso_do_dia. Apague o texto para tirar a faixa.'],
      ['6. FECHAR EM FERIADO: na aba config, aberto_forcado = fechado. Depois volte para auto.'],
      ['7. PRODUTO NOVO: copie uma linha parecida, troque o id (sem espaço nem acento, ex.: gelo-5kg) e o resto.'],
      ['   Categorias prontas: cervejas, combos-whisky, combos-gin, doses-whisky, refrigerantes,'],
      ['   energeticos, gelo, destilados, agua, petiscos, carvao. A categoria aparece sozinha quando tiver produto.'],
      ['8. SABORES DO ENERGÉTICO: aba config, linhas sabores_red_bull e sabores_bally (ex.: Tradicional, Melancia, Tropical).'],
      ['   Quando o cliente escolhe Red Bull ou Bally num combo/dose, o site pergunta o sabor. Acabou um sabor? Apague da lista.'],
      ['9. FOTO: coluna imagem da aba produtos (endereço da foto). Vazio = ícone dourado.'],
      ['10. SUB-ABAS: coluna subgrupo da aba produtos (ex.: Essências, Acessórios, Narguilé). Mesma categoria + subgrupos = abas internas.'],
      ['11. O site atualiza em até ~5 minutos depois de salvar (tempo do Google).'],
      [''],
      ['Não apague a primeira linha (cabeçalho) de nenhuma aba e não mude o nome das abas.'],
    ],
    titulo: true,
  },
];

/* ---------------- XML ---------------- */

const xmlEsc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
const col = (i) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

function folha(aba) {
  const n = aba.linhas.length;
  const linhas = aba.linhas.map((l, r) => {
    const cels = l.map((v, c) => {
      const ref = `${col(c)}${r + 1}`;
      const cab = r === 0;
      const estilo = cab ? (aba.titulo ? 3 : 1) : (aba.moeda?.includes(c) ? 2 : 0);
      if (v === '' || v === null || v === undefined) return estilo ? `<c r="${ref}" s="${estilo}"/>` : '';
      if (typeof v === 'number') return `<c r="${ref}" s="${estilo}"><v>${v}</v></c>`;
      return `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}">${cels}</row>`;
  }).join('');
  const cols = `<cols>${aba.larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
  const validacoes = Object.entries(aba.listas || {}).map(([alvo, lista]) => {
    const sqref = /\d/.test(alvo) ? alvo : `${alvo}2:${alvo}${Math.max(n + 200, 300)}`;
    return `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${sqref}"><formula1>"${xmlEsc(lista)}"</formula1></dataValidation>`;
  });
  const dv = validacoes.length ? `<dataValidations count="${validacoes.length}">${validacoes.join('')}</dataValidations>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0">${aba.titulo ? '' : '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'}</sheetView></sheetViews>
${cols}<sheetData>${linhas}</sheetData>${dv}</worksheet>`;
}

const arquivos = {
  '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`,
  '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${abas.map((a, i) => `<sheet name="${a.nome}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`,
  'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF0C0C0C"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD2A046"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
</styleSheet>`,
};
abas.forEach((a, i) => { arquivos[`xl/worksheets/sheet${i + 1}.xml`] = folha(a); });

/* ---------------- ZIP ---------------- */

const TABELA = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = TABELA[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function zip(entradas) {
  const partes = [];
  const central = [];
  let pos = 0;
  for (const [nome, conteudo] of Object.entries(entradas)) {
    const dados = Buffer.from(conteudo, 'utf8');
    const comp = deflateRawSync(dados);
    const nomeBuf = Buffer.from(nome, 'utf8');
    const crc = crc32(dados);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nomeBuf.length, 26); local.writeUInt16LE(0, 28);
    partes.push(local, nomeBuf, comp);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
    cen.writeUInt32LE(0, 12); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(dados.length, 24);
    cen.writeUInt16LE(nomeBuf.length, 28); cen.writeUInt32LE(pos, 42);
    central.push(cen, nomeBuf);
    pos += 30 + nomeBuf.length + comp.length;
  }
  const cenBuf = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(Object.keys(entradas).length, 8); fim.writeUInt16LE(Object.keys(entradas).length, 10);
  fim.writeUInt32LE(cenBuf.length, 12); fim.writeUInt32LE(pos, 16);
  return Buffer.concat([...partes, cenBuf, fim]);
}

writeFileSync(SAIDA, zip(arquivos));
console.log(`Planilha gerada: site/extras/modelo-catalogo.xlsx (${cat.produtos.length} produtos, ${cat.variantes.length} variantes)`);
