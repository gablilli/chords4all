# 🎶 chords4all

web app sveltekit per cercare e visualizzare accordi e testi dal database **AS** usando:

- endpoint acas json per la ricerca 🔍
- parsing server-side del brano per estrarre solo contenuti musicali utili 🛠️

## ✨ feature incluse

- ricerca live tramite api (`/wp-json/acas/v1/search/?query=...`) 📡
- viewer brano pulito e senza distrazioni 📖
- traspositore a semitoni 🎶
- semplifica accordi 🎸
- ingrandimento/riduzione testo 🔍
- auto-scroll con 4 velocità 🔄
- diagrammi accordi chitarra (major/minor, incluse alterazioni più comuni) 🎼
- esportazione clean in pdf
- box descrizione e video youtube quando disponibili 📺

## 🏗️ stack

- sveltekit + typescript ⚡
- cheerio per parsing html lato server ✂️

## 🚀 avvio locale

```bash
npm install
npm run dev
```

se lanci `npm run dev` senza `node_modules`, lo script `predev` prova automaticamente a fare `npm install`.
dopo l'installazione, `postinstall` esegue `svelte-kit sync` per preparare `.svelte-kit`. 📦

build produzione:

```bash
npm run build
npm run preview
```

## deploy su vercel

questa app ora usa `@sveltejs/adapter-vercel`, quindi il deploy su vercel e' diretto.

1. collega il repository su vercel (`new project` -> import repository).
2. lascia framework preset su `sveltekit` (auto-detect).
3. usa questi comandi (di default in genere sono gia' corretti):

```bash
install command: npm install
build command: npm run build
output directory: .vercel/output
```

4. esegui deploy.

nota: gli endpoint server (`/api/search`, `/api/song`, `/api/artist`) vengono pubblicati come funzioni vercel tramite adapter.

## 🔌 endpoint locali

- `get /api/search?q=...` 🔎
- `get /api/song?url=...` 📄
- `get /api/artist?url=...` 📄

## ⚖️ note legali

questa app va usata solo per contenuti che hai diritto di consultare e nel rispetto dei termini del sito sorgente **AS** e delle norme sul diritto d'autore. 🛡️