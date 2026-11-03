# Adega KM28 · Cardápio digital

Cardápio online com carrinho e pedido pelo WhatsApp. Um link só, no lugar das artes de preço postadas todo dia no Status.

---

## Parte 1 · Para a adega (como mexer no dia a dia)

Tudo o que muda com frequência fica numa **planilha do Google**, que dá para editar pelo celular (app **Planilhas Google**). Salvou, o site atualiza sozinho em até **5 minutos**.

### Mudar um preço
1. Abra a planilha **Cardápio Adega KM28** no app Planilhas Google.
2. Aba **produtos** (abas ficam embaixo da tela).
3. Ache o produto e toque na célula da coluna **preco**.
4. Digite o novo valor: `32` ou `32,00` funcionam.
5. Pronto. Não precisa fazer mais nada.

> Combos com preço diferente por energético (Rocks, Eternity/Invictus) e doses com Vibe/Red Bull: o preço fica na aba **variantes**, na linha de cada opção.

### Marcar como esgotado
1. Aba **produtos**, coluna **disponivel**.
2. Troque **SIM** por **NÃO**. O item fica cinza, com o selo "Esgotado", e ninguém consegue pedir.
3. Chegou mercadoria? Volte para **SIM**.

> Acabou só o Red Bull do combo? Na aba **variantes**, marque **NÃO** só na linha do Red Bull. O Bally continua disponível.

### Colocar o aviso do dia (a faixa amarela no topo)
1. Aba **config**, linha **aviso_do_dia**, coluna **valor**.
2. Escreva o recado, por exemplo: `Heineken em promoção hoje!`
3. Para tirar a faixa, apague o texto.

### Colocar um item em destaque
Na aba **produtos**, coluna **destaque**, escreva **Mais pedido** ou **Promo**. O item ganha o selo e aparece nos carrosséis **Mais pedidos** e **Em promoção**, logo no começo do cardápio. Apague para tirar.

### Sabores do Red Bull e do Bally
Aba **config**, linhas **sabores_red_bull** e **sabores_bally** (ex.: `Tradicional, Melancia, Tropical`). Quando o cliente escolhe Red Bull ou Bally num combo ou dose, o site pede o sabor, e ele vai na mensagem ("Red Bull Melancia"). Acabou um sabor? Apague da lista. Lista vazia = não pergunta sabor.

### Sabores com foto (essências)
Na aba **variantes**, cada sabor tem uma coluna **imagem**. Quando o produto tem sabores com foto, o cliente vê uma grade de fotos com o nome de cada sabor. Para incluir um sabor novo: copie uma linha da mesma marca e troque o nome (e a foto, se tiver).

### Sub-abas dentro da categoria
Coluna **subgrupo** da aba **produtos**. Produtos da mesma categoria com subgrupos diferentes ganham abas internas (ex.: Narguilé e Essências → `Essências` · `Acessórios` · `Narguilé`) e títulos separando cada grupo. A ordem segue a coluna `ordem`.

### Esconder cigarros e essências
Aba **config**, linha **mostrar_tabaco**: **NÃO** tira do site, na hora, a categoria Cigarros e as essências (produtos com a tag `tabaco`) da categoria Narguilé e Essências, e também dos carrinhos. **SIM** mostra de novo. Os acessórios de narguilé continuam aparecendo.

### Produto vendido por unidade ou caixa
Exemplo do carvão: na aba **variantes**, grupo `Quantidade`, uma linha `Unidade` e outra `Caixa`, cada uma com o seu preço. O cliente escolhe na hora de adicionar.

### Taxa por bairro
Aba **bairros**: `bairro | taxa` (ex.: `Jardim São Rafael | 2,00`). O cliente digita o CEP, o bairro vem do ViaCEP e a taxa aparece na hora. Bairro fora da lista = "taxa a combinar". Maiúsculas e acentos não importam.

### Fotos dos produtos
Coluna **imagem** da aba **produtos**: o endereço da foto (ex.: `assets/img/produtos/heineken.webp`). Vazio = ícone dourado. O ideal é trocar pelas fotos do próprio estoque da adega.

### Fechar num feriado (ou abrir fora do horário)
Aba **config**, linha **aberto_forcado**: escreva **fechado** (ou **aberto**). Depois volte para **auto**, que segue o horário normal:
seg a qua 09h às 23h · qui a dom 11h às 02h.

> Fechado, o cliente ainda consegue montar e mandar o pedido; o site avisa que vocês respondem quando abrirem.

### Trocar a chave Pix
Aba **config**:
- **chave_pix**: a chave (CNPJ só com números, telefone com DDD, e-mail ou chave aleatória)
- **tipo_chave**: CNPJ, CPF, telefone, email ou aleatoria
- **nome_recebedor**: o nome que aparece no Pix
- **cidade_pix**: a cidade, sem acento (ex.: SAO PAULO)
- **banco**: opcional, só para mostrar ao cliente

Depois de trocar, faça um pedido de teste e **leia o QR Code no app do banco sem pagar**: confira se o nome e o valor estão certos.

### Taxa de entrega e pedido mínimo
- Taxa igual para todo mundo: aba **config**, linha **taxa_entrega** (ex.: `5,00`). Vazio = "a combinar".
- Taxa por bairro: preencha a aba **bairros** (bairro | taxa). Com ela preenchida, o cliente escolhe o bairro e a taxa entra no total.
- Pedido mínimo: aba **config**, linha **pedido_minimo**. Vazio = sem mínimo.

### Produto novo
1. Na aba **produtos**, copie uma linha parecida e cole embaixo.
2. Troque o **id** (sem espaço e sem acento, ex.: `gelo-5kg`), o **nome**, o **detalhe** e o **preco**.
3. Na coluna **categoria**, use uma das prontas: `cervejas`, `combos-whisky`, `combos-gin`, `doses-whisky`, `refrigerantes`, `energeticos`, `gelo`, `destilados`, `agua`, `petiscos`, `carvao`.
   A categoria aparece no site assim que tiver o primeiro produto.
4. Se tiver opções (sabor, energético), cadastre na aba **variantes** usando o mesmo **id**.

**Não apague a primeira linha de nenhuma aba e não mude o nome das abas.**

### Como chega o pedido
O cliente toca em **Enviar pedido no WhatsApp** e a mensagem já vem pronta, com número do pedido (ex.: `KM28-0211-4821`), itens, total, endereço e forma de pagamento. Confira os itens e confirme. Se for **Pix**, o site pede ao cliente para **esperar a confirmação antes de pagar** e enviar o comprovante na conversa. O número do pedido também aparece na descrição do Pix, o que ajuda a conferir.

---

## Parte 2 · Para o desenvolvedor

### Estrutura
```
site/
├── index.html, 404.html, manifest.webmanifest, sw.js
├── assets/{css,fonts,icons,img,js/vendor}   (fontes self-hosted; qrcode-generator 1.4.4, MIT)
├── data/config.js       URLs da planilha, WhatsApp, horários, categorias
├── data/catalogo.json   catálogo local: fallback e "Plano B" sem planilha
├── js/                  app, catalogo, carrinho, checkout, whatsapp, pix, horario, util
├── tests/               node --test
└── extras/              modelo-catalogo.xlsx, QR Code, PDF A5, arte de Status
../ferramentas/          servidor local, gerador de imagens/planilha, testes no Chrome (não publicar)
```
HTML, CSS e JS puros (ES modules), sem build. Valores sempre em **centavos**.

### Rodar e testar
```bash
cd site
node --test                                  # testes de unidade (Pix, horário, carrinho, CSV, mensagem)
node ../ferramentas/servidor.mjs             # http://localhost:8080 + endereço para abrir no celular (mesmo Wi-Fi)
node ../ferramentas/testar-fluxos.mjs        # fluxos completos no Chrome headless + prints em ferramentas/prints/
node ../ferramentas/auditar.mjs axe.min.js   # velocidade (4G + CPU 4x) e acessibilidade (axe-core 4.10.2)
```
Medição local (360 px, 4G simulado, CPU 4x mais lenta, sem cache): primeira pintura 1,2–1,6 s, maior pintura 1,4–2,2 s, cardápio na tela em 0,6–0,9 s, CLS 0, ~120 KB transferidos. axe-core: nenhum problema no portão, cardápio, opções, carrinho e finalização. **Rode o Lighthouse oficial depois de publicar** (PageSpeed Insights): aqui o npm não conseguiu baixá-lo por bloqueio de rede.
`npx serve site` também funciona. O service worker só registra em `https` ou `localhost`.

### Ligar a planilha do Google
1. No Google Planilhas: **Arquivo › Importar › Fazer upload** do `extras/modelo-catalogo.xlsx` (opção "Substituir planilha"). Renomeie para **Cardápio Adega KM28** e compartilhe com a adega como **editor**.
2. **Arquivo › Compartilhar › Publicar na Web**. Para cada aba (`produtos`, `variantes`, `config`, `bairros`), escolha a aba e o formato **Valores separados por vírgula (.csv)**, publique e copie o link (`.../pub?gid=...&single=true&output=csv`).
3. Cole os 4 links em `data/config.js` → `planilha`. Publique o site de novo.
4. Confira: rodapé do site mostra "Preços atualizados agora." quando a planilha carregou.

Funcionamento: o site mostra na hora o último catálogo salvo no aparelho, busca a planilha (até 5 s) e atualiza. Se a planilha falhar, usa o último salvo ou o `data/catalogo.json`. O carrinho é revalidado: preço mudou ou item esgotou → aviso no carrinho.

**Plano B (sem planilha):** deixe as URLs vazias e edite `data/catalogo.json` (preços em centavos: `32,00` → `3200`). Depois rode `node ferramentas/prerender.mjs` e republique o site.

**Pré-render:** o `index.html` já traz a lista de produtos escrita (gerada de `data/catalogo.json` por `ferramentas/prerender.mjs`). Assim o cardápio aparece na primeira pintura, antes do JavaScript, e os produtos ficam visíveis para o Google. Ao carregar, o app compara uma assinatura (`data-assinatura`) e só redesenha a lista se algo mudou (planilha com outro preço, item esgotado). Se esquecer de rodar o pré-render, nada quebra: o app corrige a lista em fração de segundo.

### Publicar
- **Netlify** (recomendado): arraste a pasta `site` em app.netlify.com/drop, ou conecte o repositório com *publish directory* = `site`. Sem comando de build.
- **Vercel**: `vercel --cwd site` (framework "Other", sem build).
- **GitHub Pages**: publique o conteúdo de `site` na raiz do branch `gh-pages`. Em subpasta (`usuario.github.io/repo/`), os links de `404.html` (que usam `/`) precisam de ajuste; o resto usa caminhos relativos.
- **Domínio** (sugestão: `adegakm28.com.br`, registro no registro.br): no Netlify, *Domain management › Add domain* e aponte o DNS conforme indicado (CNAME `www` + ALIAS/A na raiz). HTTPS é automático.

Depois de publicar:
1. Gere de novo as artes com o link final (tira a faixa "PRÉVIA"):
   `node ferramentas/gerar-imagens.mjs --url https://adegakm28.com.br --final`
2. Troque `og:image` em `index.html` pelo endereço completo (`https://adegakm28.com.br/assets/img/og.png`): o WhatsApp exige URL absoluta para mostrar a prévia.
3. A cada mudança em arquivos do site, aumente `VERSAO` em `sw.js` (ex.: `km28-v2`) para os celulares pegarem a versão nova.

### Pix (BR Code)
`js/pix.js` gera o Pix Copia e Cola estático (EMV): campos 00, 26 (GUI `br.gov.bcb.pix` + chave), 52, 53, 54 (valor), 58, 59 (até 25), 60 (até 15), 62/05 (txid = número do pedido, só letras e números) e 63 (CRC16-CCITT-FALSE). O teste `tests/pix.test.mjs` reproduz byte a byte o exemplo do manual do Banco Central (CRC `1D3D`).
- Com taxa de entrega "a combinar", o código sai **sem valor** (o cliente digita o total confirmado).
- **Validar de verdade:** faça um pedido de teste, toque em "Mostrar QR Code" no computador e leia com o app do banco. Confira **recebedor** e **valor** na tela de confirmação e **cancele sem pagar**.

### Gerar extras
```bash
node ferramentas/gerar-planilha.mjs                              # extras/modelo-catalogo.xlsx a partir do catalogo.json
node ferramentas/gerar-imagens.mjs --url https://SEU-LINK --final  # ícones, og.png, QR, PDF A5 e arte de Status
```

### Fotos
As fotos atuais vêm do **Wikimedia Commons** (licenças livres: CC0, CC BY, CC BY-SA, domínio público), recortadas e convertidas para WebP. Autor e licença de cada uma ficam em `CREDITOS-FOTOS.md` e `data/creditos-fotos.json`, e aparecem no rodapé do site ("Imagens ilustrativas · créditos das fotos"), como as licenças pedem. Fotos do Google Imagens **não** foram usadas: pertencem a terceiros.
- Lista de fotos: `ferramentas/fotos.json` (arquivo de destino ← título no Commons, tamanho, recorte `conter` para garrafa inteira).
- Gerar ou refazer: `node ferramentas/processar-fotos.mjs` (`--refazer` regera todas).
- Foto própria da adega: salve em `assets/img/produtos/`, quadrada, ~320 px, WebP, e preencha a coluna `imagem`.

### Endereço automático
No checkout, o **CEP é o primeiro campo**: número, complemento e referência ficam bloqueados até o CEP ser encontrado. Rua e bairro vêm do **ViaCEP** e ficam travados (não editáveis). Abaixo do CEP aparece a lista de bairros com as taxas (aba `bairros`), e a taxa do bairro do cliente entra no total na hora. Se o CEP não existir, os campos são liberados para digitar. Quem não sabe o CEP toca em "Não sei meu CEP", digita a rua e escolhe a sugestão (busca na cidade/UF de `CONFIG.endereco`), que preenche CEP e bairro. Capas das essências: `node ferramentas/gerar-capas-essencias.mjs`.

### Privacidade
Nenhum dado sai do navegador, a não ser pela mensagem que o próprio cliente envia no WhatsApp. Nome e endereço ficam no `localStorage` só se o cliente marcar "Lembrar" (botão "Esquecer meus dados" no checkout). O nome da rua e o CEP são consultados no ViaCEP para completar o endereço.
