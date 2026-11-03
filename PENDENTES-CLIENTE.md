# Pendências com a Adega KM28

O cardápio já funciona sem estes dados. Onde falta informação, o site usa a saída mais segura (ex.: taxa "a combinar"). Cada item resolvido é ajustado na planilha ou no `data/config.js`, sem mexer no código.

## ⚠️ Prioridade: logo com personagem
O logo atual usa o **Homer Simpson**, personagem protegido por direitos autorais (The Simpsons / Disney). O site **não usa o personagem**: foi criado um selo tipográfico ("Adega" + "KM28", preto e dourado).
**Recomendação:** redesenhar o logo sem o personagem antes de imprimir mais material (fachada, copos, adesivos, cardápio de balcão). O selo do site pode servir de base.

## Já resolvido com dados públicos (confirmar)
Consultado no CNPJ 59.614.773/0001-00 (a chave Pix informada):
- Razão social **KM28 Comércio de Bebidas Ltda** → usado como nome do recebedor no Pix.
- Endereço **Rua Frei Amador Arrais, 58 · Jardim São Rafael · São Paulo/SP · CEP 04860-050**.
- [ ] Confirmar que esse é o endereço de retirada e que o Pix cai nessa conta.

## Pagamento
- [ ] **Banco** da conta Pix (opcional, só para exibir).
- [ ] Aceita **crédito** e **débito** na maquininha da entrega? Bandeiras?
- [ ] Aceita **dinheiro** com troco? (o site já pede "troco para quanto")
- [ ] Hoje as 4 formas aparecem. Para tirar uma, editar `pagamentos` na aba config.

## Entrega
- [ ] **Taxa de entrega**: fixa? por bairro? grátis acima de algum valor? (hoje: "a combinar")
- [ ] **Bairros atendidos** (para a aba bairros, com a taxa de cada um)
- [ ] **Pedido mínimo** (hoje: sem mínimo)
- [ ] **Tempo médio** de entrega (pode virar aviso do dia)
- [ ] Faz **retirada no balcão**? (hoje: opção ligada)

## ⚠️ Cigarros e essências no site (decisão da adega)
A Lei 9.294/1996, **art. 3º-A, inciso III**, proíbe a propaganda de produtos de tabaco "por meio eletrônico, inclusive internet". Cigarros e essências (que contêm tabaco) aparecem no cardápio online **por decisão do Nicolas** (02/11/2026), sem foto de maço, com advertência do Ministério da Saúde e restrição de 18 anos.
- [ ] A adega precisa estar ciente do risco de autuação. **Para tirar tudo do ar em segundos:** planilha → aba config → `mostrar_tabaco` = **NÃO** (somem as essências — que agora ficam dentro de "Narguilé e Essências" — e os cigarros, inclusive dos carrinhos abertos; os acessórios continuam).
- [ ] Cigarros: as marcas e os preços atuais são **exemplos** (Marlboro, Lucky Strike, Dunhill, Rothmans). Mandar a lista real.

## Fotos da Tabacaria Premium (uso autorizado)
Segundo o Nicolas (02/11/2026), a **Tabacaria Premium autorizou** o uso das fotos de produto do site dela. Foram usadas 18 fotos (pasta `site/assets/img/loja/`), salvas no próprio site (sem puxar do servidor deles) e creditadas no rodapé. Fotos com personagens de terceiros (rosh/narguilé "Batman", "Wolverine" etc.) ficaram de fora.
- [ ] **Guardar a autorização por escrito** (print da conversa ou e-mail) junto com os arquivos do projeto.
- [ ] Ziggy: só 4 sabores têm foto real da embalagem (Pink Lemonade, Happy Frutti, Happy Berry, Tropical); os outros usam foto de fruta. Onix: 7 sabores com foto real (Coke, Drops, Kiwi Drops, Purple Drops, Red Drops, Goiaba e Morango, Melão).
- [ ] Para trocar/incluir fotos: `ferramentas/fotos.json` (campo `url`) + `node ferramentas/processar-fotos.mjs`.

## ⚠️ Essências de narguilé (decisão da adega)
As essências (Ziggy, Onix) são **produtos de tabaco**. A Lei 9.294/1996 limita a propaganda de tabaco à exposição no ponto de venda físico; mostrar fotos e preços num cardápio online pode gerar autuação. Por decisão do Nicolas em 02/11/2026, a seção **foi publicada visível** com o selo "Novidade", a advertência do Ministério da Saúde e a restrição de 18 anos (portão de idade + checkbox no pedido).
- [ ] A adega está ciente do risco e quer manter? Se não, basta apagar as linhas das essências na planilha (a categoria some sozinha).
- [ ] **Sabores em estoque**: a Ziggy 50 g tem os 20 sabores do catálogo da marca (19 da página de referência + Pink Lemonade, a novidade). Confirmar quais a adega tem e apagar os outros. Onix: ainda exemplos (Menta, Melancia, Uva, Limão, Mirtilo, Morango). As fotos dos sabores são de frutas (ilustrativas).

## ⚠️ Valores de TESTE (trocar antes de publicar)
- [ ] **Taxas de entrega**: Jardim São Rafael R$ 2,00 e Jardim Guanabara R$ 4,00 (teste). Outros bairros = "a combinar". Mandar a tabela real de bairros.
- [ ] **Preços dos itens novos** (teste): Essência Ziggy R$ 18; Ziggy Pink Lemonade R$ 18; Essência Onix R$ 15; Narguilé completo R$ 120; Carvão unidade R$ 1,50 / caixa R$ 25; Rosh R$ 25; Abafador R$ 15; Alumínio R$ 8; Cigarros R$ 10,50 a R$ 13; Água sem gás 500 ml R$ 3; Água com gás 500 ml R$ 4; Garrafão 5 L R$ 12; Salgadinho R$ 8; Chocolate R$ 7.
- [ ] Quantas pastilhas vêm na **caixa de carvão** e o peso (para o detalhe).
- [ ] Volumes e marcas das águas, salgadinhos e chocolates.

## ⚠️ Confirmar antes de publicar (exemplos colocados no site)
- [ ] **Mais pedidos** (exemplo): Original 15, Heineken lata 8, Combo Black Label, Combo Rocks, Dose Red Label. Trocar pelos que mais saem de verdade.
- [ ] **Em promoção** (exemplo): Skol 15 e Combo Red Label. **Não publicar com selo "Promo" se não houver promoção real** (propaganda enganosa, CDC art. 37).
- [ ] **Sabores do Red Bull e do Bally**: hoje Tradicional, Melancia e Tropical para os dois. Confirmar quais a adega tem (e se o Vibe das doses tem sabores).
- [ ] **Fotos**: são ilustrativas, do Wikimedia Commons (licenças livres, com créditos no site). Algumas mostram outra embalagem (garrafa em vez de lata, rótulo antigo). O ideal é a adega mandar fotos próprias. Sem foto ainda: Skol, Petra, Itaipava, Heineken 0.0, Buchanan's, Cavalo Branco, Chanceler, Beefeater, Tanqueray Bossa Nova, Rocks, Eternity/Invictus, Jack Maçã Verde, Schweppes, 2 L.

## Produtos e preços
- [ ] Confirmar os preços atuais (as artes tinham valores editados por cima: Original c/8, Skol, Amstel, Spaten).
- [ ] **Volume das latas** de cerveja (350 ml? 269 ml?) para colocar no detalhe.
- [ ] **Combos premium de gin** (Tanqueray, Bombay, Beefeater, Gordon's): Red Bull e Bally custam o mesmo? (hoje: mesmo preço, como na arte)
- [ ] **Combos de whisky**: tamanho das garrafas (1 L? 750 ml?) e se o energético pode ser trocado.
- [ ] **Doses** vão no delivery? (hoje: sim, porque a arte diz "Chama que levamos até você!". Se forem só no balcão, marcar `somente_balcao = SIM`.)
- [ ] **Jack Daniel's Sabores** (dose): quais sabores? (hoje: "sabor a combinar no WhatsApp")
- [ ] **Fanta lata**: quais sabores? (hoje: Laranja e Uva, que aparecem na foto da arte)
- [ ] Preferem "Whisky" ou "Whisk" nos títulos? (hoje: "Whisky")
- [ ] **Outras categorias**: gelo (saco), gelo de coco avulso, energéticos avulsos (Red Bull, Bally, Vibe), destilados em garrafa, água, petiscos, carvão. A estrutura já existe; aparecem quando tiverem produto.
- [ ] Quais itens são **mais pedidos** ou estão em **promoção** (selo e aba Destaques)?
- [ ] **Fotos próprias** dos produtos (opcional; hoje são ícones dourados). Fotos de internet e recortes das artes não foram usados.

## Publicação
- [ ] **Domínio**: registrar `adegakm28.com.br` (sugestão) ou usar o endereço grátis do Netlify.
- [ ] Depois de publicar: gerar de novo QR Code, PDF A5 e arte de Status com o link final (hoje estão com a faixa "PRÉVIA").
- [ ] Criar a planilha no Google da adega e compartilhar como editor com quem vai atualizar os preços.
- [ ] Fazer um pedido teste com Pix e ler o QR no app do banco **sem pagar** para conferir nome e valor.

## Observação legal
O cardápio não inclui produtos de tabaco (publicidade restrita pela Lei 9.294/1996), mesmo o CNPJ tendo a atividade "Tabacaria". Se quiserem incluir, conversar antes.
