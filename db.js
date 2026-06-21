/* ============================================================
 *  db.js — abstraction layer for storage.
 *
 *  Due modalità:
 *  1) LOCAL (default): i viaggi vengono caricati da data/trips.json
 *     e le modifiche restano nel browser via localStorage.
 *     Utile per provare la dashboard al volo, senza configurare nulla.
 *
 *  2) FIREBASE: se esiste il file `firebase-config.js` con dentro
 *     window.FIREBASE_CONFIG = { ... } valido, i dati vivono su
 *     Firestore (DB) + Firebase Storage (PDF).
 *
 *  Il passaggio LOCAL → FIREBASE è automatico una volta presente la
 *  config. Vedi SETUP.md per le istruzioni.
 * ============================================================ */

const LOCAL_KEY = 'viaggi_trips_v1';

function loadLocalOverrides() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveLocalOverrides(trips) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(trips)); } catch {}
}

// Data di OGGI in ora LOCALE (non UTC): così la categoria cambia esattamente
// quando il calendario locale raggiunge la data di inizio del viaggio.
function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const today = todayLocalISO();
function recomputeCategory(t) {
  if (!t.start_date) t.category = 'draft';
  // Il giorno stesso della partenza il viaggio diventa "passato" e si sposta
  // nella sezione dell'anno: restano "future" solo le date STRETTAMENTE future.
  else if (t.start_date > today) t.category = 'future';
  else t.category = 'past';
  return t;
}

// Garantisce che ogni viaggio abbia un array `places` (località multiple).
// Per i viaggi vecchi (con un solo luogo nei campi legacy location_name/lat/lng)
// crea automaticamente una prima località da quei campi, così la mappa continua
// a funzionare senza migrazioni manuali.
function ensurePlaces(t) {
  if (!Array.isArray(t.places) || t.places.length === 0) {
    if (t.lat != null && t.lng != null) {
      t.places = [{
        name: t.location_name || '',
        lat: t.lat,
        lng: t.lng,
        country: t.country || '',
        country_code: t.country_code || '',
      }];
    } else {
      t.places = [];
    }
  }
  // Mantieni i campi legacy allineati alla prima località (retrocompatibilità:
  // ricerca, bandiera della card, titolo "Dove" continuano a leggerli).
  if (t.places.length) {
    const p = t.places[0];
    t.location_name = p.name;
    t.lat = p.lat;
    t.lng = p.lng;
    t.country = p.country;
    t.country_code = p.country_code;
  }
  return t;
}

/* ============== LOCAL backend ============== */
const localBackend = {
  mode: 'local',
  async loadTrips() {
    const override = loadLocalOverrides();
    if (override) return override.map(recomputeCategory).map(ensurePlaces);
    const res = await fetch('data/trips.json');
    const data = await res.json();
    return data.trips.map(recomputeCategory).map(ensurePlaces);
  },
  async saveTrip(trip) {
    let all = loadLocalOverrides();
    if (!all) {
      const res = await fetch('data/trips.json');
      all = (await res.json()).trips;
    }
    const idx = all.findIndex(t => t.id === trip.id);
    if (idx >= 0) all[idx] = trip; else all.push(trip);
    saveLocalOverrides(all);
  },
  async deleteTrip(id) {
    let all = loadLocalOverrides();
    if (!all) {
      const res = await fetch('data/trips.json');
      all = (await res.json()).trips;
    }
    saveLocalOverrides(all.filter(t => t.id !== id));
  },
  async addDocumentLink(_tripId, _fileName, _url) {
    alert('Per salvare link in modo persistente serve Firebase configurato. Vedi SETUP.md');
    throw new Error('not supported in local mode');
  },
};

/* ============== FIREBASE backend (solo Firestore — niente Storage) ============== */
// I PDF vivono nella cartella `pdfs/` del repo GitHub e vengono serviti dallo stesso
// dominio dell'app. Per nuovi PDF: trascinali nel repo via GitHub web, oppure usa
// il campo "Link al documento" per linkare un file su Drive/iCloud/Dropbox.
async function makeFirebaseBackend(config) {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js');
  const {
    getFirestore, collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy,
  } = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js');

  const app = initializeApp(config);
  const db  = getFirestore(app);

  const TRIPS = 'trips';

  return {
    mode: 'firebase',
    async loadTrips() {
      const snap = await getDocs(query(collection(db, TRIPS), orderBy('start_date', 'desc')));
      const trips = [];
      snap.forEach(d => {
        const x = d.data();
        trips.push(ensurePlaces(recomputeCategory({
          id: d.id,
          title: x.title || '',
          location_name: x.location_name || '',
          lat: x.lat ?? null,
          lng: x.lng ?? null,
          country: x.country || '',
          country_code: x.country_code || '',
          places: Array.isArray(x.places) ? x.places : null,
          start_date: x.start_date || null,
          end_date: x.end_date || null,
          notes: x.notes || [],
          expenses: x.expenses || [],
          expenses_total_eur: (x.expenses || []).reduce((s, e) => s + (e.total_eur || 0), 0),
          packing: x.packing || [],
          pdf_filenames: (x.documents || []).map(d => d.file_name),
          documents: x.documents || [],
        })));
      });
      return trips;
    },
    async saveTrip(trip) {
      // recompute expenses_total_eur server side too
      const total = (trip.expenses || []).reduce((s, e) => s + (e.total_eur || 0), 0);
      await setDoc(doc(db, TRIPS, trip.id), {
        title: trip.title,
        location_name: trip.location_name || '',
        lat: trip.lat ?? null,
        lng: trip.lng ?? null,
        country: trip.country || '',
        country_code: trip.country_code || '',
        places: Array.isArray(trip.places) ? trip.places : [],
        start_date: trip.start_date || null,
        end_date: trip.end_date || null,
        notes: trip.notes || [],
        expenses: trip.expenses || [],
        expenses_total_eur: Math.round(total * 100) / 100,
        packing: trip.packing || [],
        documents: trip.documents || [],
        updated_at: new Date().toISOString(),
      });
    },
    async deleteTrip(id) {
      await deleteDoc(doc(db, TRIPS, id));
    },
    async addDocumentLink(tripId, fileName, url) {
      // Salva un link esterno (Drive/iCloud/Dropbox/...) come "documento" del viaggio
      const tripRef = doc(db, TRIPS, tripId);
      const snap = await getDoc(tripRef);
      const t = snap.exists() ? snap.data() : {};
      const docs = t.documents || [];
      docs.push({ file_name: fileName, public_url: url, external: true });
      await setDoc(tripRef, { ...t, documents: docs }, { merge: true });
      return { file_name: fileName, public_url: url, external: true };
    },
  };
}

/* ============== INIT (export a Promise) ============== */
async function pickBackend() {
  if (typeof window !== 'undefined' && window.FIREBASE_CONFIG?.apiKey) {
    try {
      console.info('🔥 Modalità Firebase attiva');
      return await makeFirebaseBackend(window.FIREBASE_CONFIG);
    } catch (e) {
      console.error('Firebase init fallito, fallback su modalità locale:', e);
    }
  }
  console.info('💾 Modalità locale (i tuoi viaggi sono salvati nel browser)');
  return localBackend;
}

export const db = await pickBackend();
