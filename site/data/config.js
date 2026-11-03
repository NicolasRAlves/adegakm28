// Configuração fixa do site. Preços, disponibilidade, Pix, taxa e aviso do dia
// ficam na planilha (ou em data/catalogo.json, se não houver planilha).

export const CONFIG = {
  nome: 'Adega KM28',
  slogan: 'O rolê começa aqui',

  // Google Planilhas publicada como CSV: uma URL por aba.
  // Em Arquivo > Compartilhar > Publicar na Web, escolha a aba e "Valores separados por vírgula (.csv)".
  // Deixe vazio ('') para usar só o data/catalogo.json.
  planilha: {
    produtos: '',
    variantes: '',
    config: '',
    bairros: '',
  },
  // Tempo máximo esperando a planilha antes de usar o catálogo local.
  planilhaTimeoutMs: 5000,

  whatsapp: '5511915817410',
  instagram: 'https://www.instagram.com/adegakm28',
  endereco: {
    rua: 'Rua Frei Amador Arrais, 58',
    bairro: 'Jardim São Rafael',
    cidade: 'São Paulo',
    uf: 'SP',
    cep: '04860-050',
  },

  // Horário em minutos desde 00:00. "fecha" acima de 1440 = passa da meia-noite.
  // 0 = domingo ... 6 = sábado. Fuso: America/Sao_Paulo.
  fuso: 'America/Sao_Paulo',
  horarios: {
    0: { abre: 11 * 60, fecha: 26 * 60 }, // domingo 11h às 02h
    1: { abre: 9 * 60, fecha: 23 * 60 },  // segunda 09h às 23h
    2: { abre: 9 * 60, fecha: 23 * 60 },  // terça
    3: { abre: 9 * 60, fecha: 23 * 60 },  // quarta
    4: { abre: 11 * 60, fecha: 26 * 60 }, // quinta 11h às 02h
    5: { abre: 11 * 60, fecha: 26 * 60 }, // sexta
    6: { abre: 11 * 60, fecha: 26 * 60 }, // sábado
  },

  // Categorias na ordem das abas. Categoria sem produto não aparece:
  // basta cadastrar produtos com esse id na planilha para ela surgir no site.
  // alcool: false = visível para quem respondeu "não" no portão de 18 anos.
  // prefixo: palavra que vai antes do nome na mensagem do WhatsApp.
  // foto: imagem do atalho da categoria na home. capa: banner grande no topo da seção (opcional).
  // detalheNaMensagem: inclui o detalhe ("lata · pack com 8") na mensagem.
  categorias: [
    { id: 'cervejas', foto: 'assets/img/home/cat-cervejas.webp', capa: 'assets/img/home/capa-cervejas.webp', nome: 'Cervejas', icone: 'lata', alcool: true, detalheNaMensagem: true },
    { id: 'combos-whisky', foto: 'assets/img/home/cat-whisky.webp', nome: 'Combos Whisky', icone: 'garrafa', alcool: true, prefixo: 'Combo',
      nota: 'Garrafa + 4 Red Bull + 4 gelos de coco ou 1 saco de gelo 5 kg' },
    { id: 'combos-gin', foto: 'assets/img/home/cat-gin.webp', nome: 'Combos Gin', icone: 'gin', alcool: true, prefixo: 'Combo',
      nota: 'Todos acompanham gelo de coco + o energético que você escolher' },
    { id: 'doses-whisky', foto: 'assets/img/home/cat-doses.webp', nome: 'Doses de Whisky', icone: 'dose', alcool: true, prefixo: 'Dose' },
    // narguilé: essências (produtos com a tag "tabaco") + acessórios. Só 18+ (alcool: true).
    // mostrar_tabaco = NÃO na planilha esconde as essências e os cigarros; os acessórios continuam.
    { id: 'narguile', foto: 'assets/img/home/cat-essencias.webp', nome: 'Narguilé e Essências', icone: 'narguile', alcool: true,
      nota: 'Essências (escolha a marca e veja os sabores), carvão, rosh, abafador, alumínio e narguilé completo. Venda proibida para menores de 18 anos. O Ministério da Saúde adverte: fumar faz mal à saúde.' },
    { id: 'cigarros', nome: 'Cigarros', icone: 'cigarro', alcool: true, tabaco: true,
      nota: 'Venda proibida para menores de 18 anos. O Ministério da Saúde adverte: fumar causa câncer de pulmão.' },
    { id: 'refrigerantes', foto: 'assets/img/home/cat-refri.webp', nome: 'Refrigerantes', icone: 'refri', alcool: false },
    { id: 'agua', foto: 'assets/img/home/cat-aguas.webp', nome: 'Águas e sem álcool', icone: 'refri', alcool: false },
    { id: 'mercearia', foto: 'assets/img/home/cat-mercearia.webp', nome: 'Mercearia', icone: 'petisco', alcool: false },
    { id: 'energeticos', nome: 'Energéticos', icone: 'lata', alcool: false },
    { id: 'gelo', nome: 'Gelo', icone: 'gelo', alcool: false },
    { id: 'destilados', nome: 'Destilados', icone: 'garrafa', alcool: true },
    { id: 'carvao', nome: 'Carvão', icone: 'petisco', alcool: false },
  ],
};
