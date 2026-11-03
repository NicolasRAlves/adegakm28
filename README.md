# Adega KM28 · Cardápio digital

Cardápio online da Adega KM28 com carrinho, pedido pelo WhatsApp e Pix Copia e Cola. HTML, CSS e JavaScript puros, sem build.

- **`site/`**: o site, pronto para publicar (Netlify, Vercel ou GitHub Pages). Instruções completas em [site/README.md](site/README.md).
- **`ferramentas/`**: servidor local, testes no Chrome, gerador de imagens, planilha modelo, fotos e pré-render (não vão para o ar).
- **`PENDENTES-CLIENTE.md`**: o que falta confirmar com a adega antes de publicar (preços de teste, taxas, fotos, avisos legais).

```bash
cd site
node --test                              # testes de unidade
node ../ferramentas/servidor.mjs         # http://localhost:8080
node ../ferramentas/testar-fluxos.mjs    # fluxos completos no Chrome
```

> Preços, taxas e algumas marcas estão com **valores de teste**. Fotos: Wikimedia Commons (licenças livres) e fotos de lojas parceiras usadas com autorização; créditos em `site/CREDITOS-FOTOS.md`.
