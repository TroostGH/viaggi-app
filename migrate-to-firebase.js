// =============================================================
//  Script di MIGRAZIONE: carica trips.json su Firestore.
//
//  I PDF NON vengono caricati su Firebase (resterebbero a pagamento dal piano Blaze).
//  I PDF stanno nella cartella `pdfs/` del repo GitHub e vengono serviti dallo
//  stesso dominio del sito (GitHub Pages). Il riferimento è tenuto nel campo
//  `pdf_filenames` di ogni documento Firestore.
//
//  Come usarlo:
//  1) Assicurati di avere `firebase-config.js` configurato correttamente.
//  2) Avvia la dashboard (start.command oppure online).
//  3) Apri Chrome → console (F12 → Console) ed esegui:
//
//        const s = document.createElement('script');
//        s.type = 'module';
//        s.src = 'migrate-to-firebase.js';
//        document.head.appendChild(s);
//
//  4) Aspetta circa 30 secondi e vedrai "✅ Migrazione completata".
//
//  Idempotente: puoi rieseguirlo, sovrascrive i dati esistenti.
// =============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import {
  getFirestore, doc, setDoc,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

if (!window.FIREBASE_CONFIG) {
  console.error('❌ Manca window.FIREBASE_CONFIG — configura firebase-config.js prima.');
  throw new Error('No Firebase config');
}

const app = initializeApp(window.FIREBASE_CONFIG);
const db  = getFirestore(app);

console.log('📥 Carico trips.json…');
const trips = (await (await fetch('data/trips.json')).json()).trips;
console.log(`Trovati ${trips.length} viaggi.`);

let uploadedTrips = 0, errors = 0;

for (const t of trips) {
  try {
    const total = (t.expenses || []).reduce((s, e) => s + (e.total_eur || 0), 0);
    await setDoc(doc(db, 'trips', t.id), {
      title: t.title,
      location_name: t.location_name || '',
      lat: t.lat ?? null,
      lng: t.lng ?? null,
      country: t.country || '',
      country_code: t.country_code || '',
      start_date: t.start_date || null,
      end_date: t.end_date || null,
      notes: t.notes || [],
      expenses: t.expenses || [],
      expenses_total_eur: Math.round(total * 100) / 100,
      // PDF locali: l'app costruisce l'URL come `pdfs/{tripId}__{filename}` dal repo
      pdf_filenames: t.pdf_filenames || [],
      // Link esterni (Drive/iCloud/...) aggiunti in seguito dall'utente
      documents: t.documents || [],
      updated_at: new Date().toISOString(),
    });

    uploadedTrips++;
    console.log(`  ✓ ${t.title}`);
  } catch (e) {
    errors++;
    console.error(`  ✗ ${t.title}:`, e);
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Migrazione completata');
console.log(`   Viaggi caricati: ${uploadedTrips}/${trips.length}`);
console.log(`   Errori:          ${errors}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Ricarica la pagina: in console comparirà "🔥 Modalità Firebase attiva".');
