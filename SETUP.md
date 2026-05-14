# Viaggi-app — Setup

La dashboard parte già pronta con i tuoi 45 viaggi importati da Notion. Funziona in due modalità:

1. **Locale (default)** — i viaggi vengono caricati da `data/trips.json` e le modifiche restano nel browser. Comodo per provarla subito.
2. **Firebase + GitHub Pages** — quando vuoi sincronia tra desktop e telefono: dati su Firestore, PDF su Firebase Storage, sito ospitato gratis su GitHub Pages.

---

## Step 0 — Prova subito in locale

Doppio click su `start.command` (l'ho già reso eseguibile). Si apre Terminal con un server Python e Chrome con la dashboard.

> Prima volta che apri un `.command` su Mac: se ti blocca, vai in **Impostazioni di Sistema → Privacy e Sicurezza** e clicca "Apri comunque" sotto la voce relativa.

---

## Step 1 — Crea il progetto Firebase 'viaggi-app'

1. Vai su <https://console.firebase.google.com/> e clicca **"Crea un nuovo progetto Firebase"**.
2. Nome: `viaggi-app`. Continua.
3. Google Analytics: **disabilita** (non serve, complica solo le cose). Crea progetto.
4. Aspetta ~30 secondi. Quando è pronto, clicca **Continua**.

### 1.1 — Abilita Firestore

1. Menu di sinistra → **Firestore Database** → **Crea database**.
2. Modalità: **"Inizia in modalità di produzione"**. Continua.
3. Località: **europe-west3** (Francoforte, la più vicina). Crea.
4. Una volta creato, vai sulla scheda **Regole**, cancella tutto e incolla il contenuto di `firestore.rules`. Clicca **Pubblica**.

> Non serve abilitare Firebase Storage. I PDF restano nel repo GitHub (cartella `pdfs/`) e vengono serviti dallo stesso dominio del sito. Risparmi così l'attivazione del piano Blaze (carta di credito).

### 1.2 — Registra un'app web e recupera la config

1. Vai su **⚙ Impostazioni progetto** (icona ingranaggio in alto a sinistra).
2. Scorri fino a **"Le tue app"** → clicca l'icona web `</>`.
3. Soprannome app: `viaggi-app-web`. **NON** spuntare "Configura Firebase Hosting" (useremo GitHub Pages). Registra app.
4. Ti mostra un blocco di codice con `const firebaseConfig = { apiKey: "...", authDomain: "...", ... }`. **Copia questo oggetto.**

### 1.3 — Crea `firebase-config.js` nella cartella `dashboard`

Duplica `firebase-config.example.js` chiamandolo `firebase-config.js`, poi incolla dentro i valori che hai copiato dal punto precedente.

Esempio finito:
```js
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyD-AbCdEfGh...",
  authDomain: "viaggi-app-1234.firebaseapp.com",
  projectId: "viaggi-app-1234",
  storageBucket: "viaggi-app-1234.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef1234567890",
};
```

> Il config Firebase è **safe da pubblicare** — è una chiave client-side, non un segreto. La sicurezza la danno le regole Firestore/Storage.

---

## Step 2 — Carica i tuoi 45 viaggi su Firestore

1. Avvia la dashboard in locale (doppio click su `start.command`).
2. Apri Chrome con la console attiva (F12 → Console).
3. Incolla questo snippet ed esegui (Invio):

```js
const s = document.createElement('script');
s.type = 'module';
s.src = 'migrate-to-firebase.js';
document.head.appendChild(s);
```

Vedrai uno scroll di righe `✓ Tarifa - 11/18 Luglio 2026`, `✓ Zanzibar...`. In circa 30 secondi la console stamperà:

```
✅ Migrazione completata
   Viaggi caricati: 45/45
   Errori:          0
```

Ricarica la pagina. In console comparirà `🔥 Modalità Firebase attiva`. Da adesso ogni modifica (nuovo viaggio, nuova spesa, ecc.) viene salvata su Firestore.

> **Cosa NON viene caricato su Firebase**: i 47 PDF. Restano nella cartella `pdfs/` del repo GitHub e vengono serviti dallo stesso dominio del sito. Quando aprirai un viaggio nella dashboard, i link ai PDF puntano a `pdfs/{tripId}__{nome}.pdf` — ovvero ai file già presenti nel tuo repo.

---

## Step 3 — Pubblica su GitHub Pages (uguale a `spese-app`)

### 3.1 — Crea il repo

1. Vai su <https://github.com/new>.
2. Nome: `viaggi-app`. Public. Senza README. **Crea repo.**

### 3.2 — Carica i file

Dal Terminale (oppure da GitHub Desktop):

```bash
cd /Users/zanzara92/Documents/Claude/Projects/Viaggi/dashboard
git init -b main
git remote add origin https://github.com/TROO-IL-TUO-USER/viaggi-app.git
git add .
git commit -m "Viaggi-app: setup iniziale"
git push -u origin main
```

In alternativa: vai sulla pagina del repo appena creato → **"uploading an existing file"** → trascina tutti i file della cartella `dashboard/` (compreso `firebase-config.js`).

### 3.3 — Attiva GitHub Pages

1. Repo → **Settings** → **Pages** (menu di sinistra).
2. Source: **Deploy from a branch**. Branch: **main**. Folder: **/ (root)**. Save.
3. Aspetta 1-2 minuti. In alto comparirà l'URL: `https://TUO-USER.github.io/viaggi-app/`.

### 3.4 — Installa sul telefono

1. Apri l'URL su Safari (iPhone) o Chrome (Android).
2. iPhone: **Condividi → Aggiungi alla schermata Home**.
3. Android: Chrome ti propone direttamente **"Installa app"**.

Da quel momento hai un'icona "Viaggi" sul telefono che apre la dashboard a tutto schermo, funziona offline, e ogni modifica si sincronizza tramite Firebase.

---

## Risorse usate (tutte gratuite a vita per uso personale)

| Servizio | Free tier | Stima uso tuo |
|---|---|---|
| GitHub Pages | 100 GB banda/mese | < 1 GB |
| GitHub repo | 1 GB / repo (Pages serve fino a 1 GB) | ~ 50 MB (codice + PDF) |
| Firebase Firestore | 1 GB DB, 50K reads/giorno, 20K writes/giorno | < 1 MB DB, < 100 ops/giorno |
| Nominatim (geocoding) | 1 req/sec fair use | usato solo al `nuovo viaggio` |
| Texture globo (unpkg) | CDN pubblica | trascurabile |

**Costo totale**: 0 €/mese, per sempre. **Carta di credito NON richiesta.**

---

## File in questa cartella

| File | Scopo |
|---|---|
| `index.html` | Pagina principale |
| `styles.css` | Stile |
| `app.js` | Logica del globo, della lista e dei modali |
| `db.js` | Layer di storage (locale fallback / Firebase) |
| `data/trips.json` | I tuoi 45 viaggi importati da Notion |
| `pdfs/` | I 47 PDF (allegati ai viaggi passati) |
| `manifest.webmanifest` | Manifest PWA |
| `sw.js` | Service worker (cache + offline) |
| `firebase-config.example.js` | Template del config Firebase |
| `firebase-config.js` | **Da creare tu** dopo aver fatto il setup Firebase |
| `firestore.rules` | Regole sicurezza Firestore (incollale da Firebase Console) |
| `migrate-to-firebase.js` | Script per caricare i tuoi 45 viaggi su Firestore |
| `start.command` | Doppio click → server locale + apre browser |

---

## Come aggiungere un nuovo PDF a un viaggio (futuro)

Visto che non usiamo Firebase Storage, l'app non può uploadare file direttamente. Ma è semplicissimo:

1. Vai sul tuo repo GitHub `viaggi-app` → cartella `pdfs/`.
2. Clicca **"Add file" → "Upload files"** e trascina il PDF.
3. Rinominalo seguendo lo schema `{tripId}__{nome.pdf}`. L'`tripId` lo trovi su Firestore (è il `documentId` del viaggio, es. `tarifa-11-18-luglio-2026`). Esempio: `tarifa-11-18-luglio-2026__biglietto-volo.pdf`.
4. Commit → GitHub Pages aggiorna il sito in ~30 secondi.
5. Su Firestore, apri il documento del viaggio → campo `pdf_filenames` → aggiungi `biglietto-volo.pdf` alla lista.

Per i PDF di Drive/iCloud/Dropbox è ancora più semplice: nella dashboard apri il viaggio → "Aggiungi link documento" (lo aggiungo come bottone se mi dici che ti serve), incolla l'URL.

## Cose che puoi aggiungere dopo

- **Login Firebase Auth**: se in futuro vuoi un livello in più di sicurezza, basta abilitare Authentication in Firebase, attivare il provider Email o Google, e modificare `firestore.rules` per richiedere `request.auth.uid == "TUO_UID"`. Ti aiuto io quando vorrai.
- **Auto-deploy con GitHub Actions**: ogni `git push` deploya in automatico (è già così per default su Pages, ma si può estendere con build/test).
- **Backup automatico**: una scheduled task settimanale che esporta Firestore su Google Drive (gratis col tuo account Google).
- **Statistiche avanzate**: grafici "spese per anno", "paesi per continente", "ROI per tipologia di viaggio".
- **Foto dei viaggi**: galleria per ogni viaggio (Firebase Storage ha spazio in abbondanza).
- **Import automatico email volo**: incolla la conferma → estrae aeroporti/orari/costo.
