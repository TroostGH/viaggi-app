/* ============================================================
 *  Viaggi di Davide — dashboard with 3D globe
 *  Vanilla JS, ES module. Uses globe.gl from CDN.
 * ============================================================ */
import { db } from './db.js';

const TODAY = new Date().toISOString().slice(0, 10);

const COLORS = {
  past:   '#22c55e',  // verde
  future: '#3b82f6',  // blu
  draft:  '#f59e0b',  // ambra
};

// Country code (ISO 2) → flag emoji
function flagEmoji(cc) {
  if (!cc || cc.length !== 2) return '🌍';
  const base = 0x1F1E6;
  return String.fromCodePoint(...cc.toUpperCase().split('').map(c => base + c.charCodeAt(0) - 65));
}

// "2026-09-03" → "3 Sett 2026"
const MONTH_ABBR = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTH_ABBR[m-1]} ${y}`;
}
function fmtRange(start, end) {
  if (!start || !end) return '—';
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  if (ys === ye && ms === me) return `${ds}-${de} ${MONTH_ABBR[ms-1]} ${ys}`;
  if (ys === ye) return `${ds} ${MONTH_ABBR[ms-1]} - ${de} ${MONTH_ABBR[me-1]} ${ys}`;
  return `${ds} ${MONTH_ABBR[ms-1]} ${ys} - ${de} ${MONTH_ABBR[me-1]} ${ye}`;
}
function fmtMoney(n) {
  if (n == null || n === 0) return '€0';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}
function durationDays(start, end) {
  if (!start || !end) return null;
  const a = new Date(start), b = new Date(end);
  return Math.round((b - a) / 86400000) + 1;
}

/* ============== STATE ============== */
let state = {
  trips: [],
  filter: 'all',       // all | past | future | draft
  search: '',
  openTripId: null,
};

/* ============== GLOBE ============== */
let globe = null;
function initGlobe() {
  const el = document.getElementById('globe');
  const N_clouds = 0; // keep it simple

  globe = Globe()(el)
    // Texture realistica della Terra (NASA Blue Marble, servita da CDN)
    .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
    .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
    .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
    .pointAltitude(d => d.alt || 0.02)
    .pointRadius(d => d.radius || 0.35)
    .pointColor(d => d.color)
    .pointLabel(d => `
      <div style="font-family: system-ui; font-size: 13px; background: rgba(10,18,32,0.95); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="font-weight: 600; color: white;">${flagEmoji(d.country_code)} ${escapeHtml(d.title)}</div>
        <div style="color: #94a3b8; font-size: 12px;">${d.start_date ? fmtRange(d.start_date, d.end_date) : 'data da definire'}</div>
      </div>`)
    .onPointClick(d => openTripModal(d.id))
    .pointsTransitionDuration(800);

  // Atmosphere
  globe
    .showAtmosphere(true)
    .atmosphereColor('#7baaff')
    .atmosphereAltitude(0.18);

  // Auto-rotate slowly
  const controls = globe.controls();
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  // Stop rotation on user interaction
  let userInteracted = false;
  ['mousedown','touchstart','wheel'].forEach(ev => {
    el.addEventListener(ev, () => {
      if (!userInteracted) {
        userInteracted = true;
        controls.autoRotate = false;
        document.getElementById('globe-hint').classList.add('hidden');
      }
    }, { passive: true });
  });

  // Hide hint after 5s anyway
  setTimeout(() => document.getElementById('globe-hint').classList.add('hidden'), 5000);

  // Resize on window
  const resize = () => {
    const rect = el.getBoundingClientRect();
    globe.width(rect.width).height(rect.height);
  };
  window.addEventListener('resize', resize);
  resize();
}

function updateGlobePoints() {
  const visible = filteredTrips().filter(t => t.lat != null && t.lng != null);
  const points = visible.map(t => ({
    id: t.id,
    title: t.title,
    country_code: t.country_code,
    start_date: t.start_date,
    end_date: t.end_date,
    lat: t.lat,
    lng: t.lng,
    color: COLORS[t.category],
    radius: state.openTripId === t.id ? 0.7 : 0.35,
    alt: state.openTripId === t.id ? 0.04 : 0.02,
  }));
  globe.pointsData(points);
}

function flyToTrip(t) {
  if (!globe || t.lat == null) return;
  globe.pointOfView({ lat: t.lat, lng: t.lng, altitude: 1.4 }, 1200);
}

/* ============== FILTER & RENDER ============== */
function filteredTrips() {
  let list = state.trips;
  if (state.filter !== 'all') {
    list = list.filter(t => t.category === state.filter);
  }
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.country || '').toLowerCase().includes(q) ||
      (t.location_name || '').toLowerCase().includes(q)
    );
  }
  return list;
}

function renderList() {
  const container = document.getElementById('trip-list');
  const list = filteredTrips();

  // group: future first, past by year, drafts last
  const groups = { future: [], drafts: [] };
  for (const t of list) {
    if (t.category === 'future') groups.future.push(t);
    else if (t.category === 'draft') groups.drafts.push(t);
    else {
      const y = (t.start_date || '').slice(0, 4) || 'Sconosciuto';
      groups[y] = groups[y] || [];
      groups[y].push(t);
    }
  }

  const yearKeys = Object.keys(groups).filter(k => /^\d{4}$/.test(k)).sort().reverse();
  const order = ['future', ...yearKeys, 'drafts'];

  let html = '';
  for (const k of order) {
    const trips = groups[k];
    if (!trips || !trips.length) continue;
    const label = k === 'future' ? 'Prossimi viaggi' : k === 'drafts' ? 'Idee / da pianificare' : k;
    html += `<div class="trip-group">${label}</div>`;
    for (const t of trips) {
      const highlighted = state.openTripId === t.id ? 'highlighted' : '';
      html += `
        <div class="trip-card cat-${t.category} ${highlighted}" data-trip-id="${t.id}">
          <div class="trip-card-flag">${flagEmoji(t.country_code)}</div>
          <div class="trip-card-body">
            <div class="trip-card-title">${escapeHtml(t.title)}</div>
            <div class="trip-card-meta">
              <span>${t.country || ''}</span>
              ${t.start_date ? `<span>•</span><span>${fmtRange(t.start_date, t.end_date)}</span>` : '<span>•</span><span>data libera</span>'}
            </div>
            ${t.expenses_total_eur > 0 ? `<div class="trip-card-spent">${fmtMoney(t.expenses_total_eur)} spesi</div>` : ''}
          </div>
        </div>`;
    }
  }

  if (!list.length) {
    html = `<div style="padding: 40px 20px; text-align: center; color: var(--text-muted); font-size: 14px;">Nessun viaggio trovato.</div>`;
  }

  container.innerHTML = html;

  container.querySelectorAll('.trip-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.tripId;
      openTripModal(id);
    });
  });
}

function renderStats() {
  const trips = state.trips;
  const countries = new Set(trips.filter(t => t.country).map(t => t.country));
  const spent = trips.reduce((s, t) => s + (t.expenses_total_eur || 0), 0);
  document.getElementById('stat-trips').textContent = `${trips.length} viaggi`;
  document.getElementById('stat-countries').textContent = `${countries.size} paesi`;
  document.getElementById('stat-spent').textContent = fmtMoney(spent);
}

/* ============== TRIP MODAL ============== */
function openTripModal(id) {
  const t = state.trips.find(x => x.id === id);
  if (!t) return;
  state.openTripId = id;
  flyToTrip(t);
  updateGlobePoints();

  const content = document.getElementById('modal-trip-content');
  const dur = durationDays(t.start_date, t.end_date);

  const expensesRows = (t.expenses || []).map((e, idx) => `
    <tr data-exp-idx="${idx}">
      <td>${escapeHtml(e.name)}</td>
      <td class="num">${e.total_eur != null ? fmtMoney(e.total_eur) : '—'}</td>
      <td class="num">${e.days ?? '—'}</td>
      <td class="num">${e.total_eur != null && e.days ? fmtMoney(e.total_eur / e.days) : '—'}</td>
      <td><button class="btn-delete" data-action="del-expense" data-idx="${idx}" title="Elimina">🗑</button></td>
    </tr>
  `).join('');

  const notesHtml = (t.notes && t.notes.length) ? t.notes.map(n => `
    <div class="note-item">
      <h4>${escapeHtml(n.heading)}</h4>
      ${n.body ? `<p>${escapeHtml(n.body)}</p>` : '<p style="color:var(--text-muted);font-style:italic">(senza dettagli)</p>'}
    </div>
  `).join('') : `<p class="expenses-empty">Nessuna nota.</p>`;

  const docsHtml = (t.pdf_filenames && t.pdf_filenames.length) ? `
    <div class="doc-list">
      ${t.pdf_filenames.map(fn => {
        const safe = fn.replace(/[^\w.-]/g, '_');
        return `<a class="doc-item" href="pdfs/${t.id}__${safe}" target="_blank" rel="noopener">
          <div class="doc-icon">PDF</div>
          <div class="doc-name">${escapeHtml(fn)}</div>
        </a>`;
      }).join('')}
    </div>
  ` : `<p class="expenses-empty">Nessun documento caricato.</p>`;

  content.innerHTML = `
    <div class="trip-hero">
      <div class="trip-hero-cat cat-${t.category}">
        <span class="dot dot-${t.category}"></span>
        ${t.category === 'future' ? 'Prossimo viaggio' : t.category === 'past' ? 'Viaggio fatto' : 'Idea'}
      </div>
      <h1>${flagEmoji(t.country_code)} ${escapeHtml(t.title)}</h1>
      <div class="trip-hero-meta">
        ${t.location_name ? `<span><b>Dove:</b> ${escapeHtml(t.location_name)}${t.country ? ', ' + escapeHtml(t.country) : ''}</span>` : ''}
        ${t.start_date ? `<span><b>Quando:</b> ${fmtRange(t.start_date, t.end_date)}</span>` : ''}
        ${dur ? `<span><b>Durata:</b> ${dur} giorni</span>` : ''}
      </div>
    </div>

    <div class="trip-section">
      <h3>
        <span>Spese</span>
        <span class="section-total">${fmtMoney(t.expenses_total_eur || 0)} totali</span>
      </h3>
      ${t.expenses && t.expenses.length ? `
        <table class="expenses-table">
          <thead><tr><th>Voce</th><th class="num">Totale</th><th class="num">Giorni</th><th class="num">Giornaliera</th><th></th></tr></thead>
          <tbody id="expenses-tbody">${expensesRows}</tbody>
        </table>
      ` : `<p class="expenses-empty">Nessuna spesa registrata.</p>`}
      <div class="add-expense" id="add-expense">
        <input type="text" placeholder="Voce (es. Volo)" id="exp-name">
        <input type="number" step="0.01" placeholder="€ Totale" id="exp-total">
        <input type="number" placeholder="Giorni" id="exp-days" value="${dur || ''}">
        <button id="btn-add-expense">+ Aggiungi</button>
      </div>
    </div>

    <div class="trip-section">
      <h3><span>Note</span></h3>
      ${notesHtml}
    </div>

    <div class="trip-section">
      <h3><span>Documenti</span></h3>
      ${docsHtml}
    </div>

    <div class="trip-section trip-section-danger">
      <button class="btn-danger" id="btn-delete-trip">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"/></svg>
        Elimina viaggio
      </button>
    </div>
  `;

  document.getElementById('trip-modal').classList.remove('hidden');
  renderList(); // refresh highlighted state

  // Wire add-expense
  document.getElementById('btn-add-expense').addEventListener('click', async () => {
    const name = document.getElementById('exp-name').value.trim();
    const total = parseFloat(document.getElementById('exp-total').value);
    const days = parseInt(document.getElementById('exp-days').value) || dur;
    if (!name || isNaN(total)) {
      alert('Inserisci almeno voce e importo');
      return;
    }
    t.expenses = t.expenses || [];
    t.expenses.push({ name, total_eur: total, days, raw_total: `€${total.toFixed(2)}` });
    t.expenses_total_eur = +(t.expenses.reduce((s, e) => s + (e.total_eur || 0), 0)).toFixed(2);
    await db.saveTrip(t);
    openTripModal(t.id); // re-render
    renderStats();
  });

  content.querySelectorAll('[data-action="del-expense"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const idx = parseInt(btn.dataset.idx);
      t.expenses.splice(idx, 1);
      t.expenses_total_eur = +(t.expenses.reduce((s, e) => s + (e.total_eur || 0), 0)).toFixed(2);
      await db.saveTrip(t);
      openTripModal(t.id);
      renderStats();
    });
  });

  // Wire delete trip
  document.getElementById('btn-delete-trip').addEventListener('click', async () => {
    const ok = confirm(`Vuoi davvero eliminare il viaggio "${t.title}"?\n\nQuesta azione non si può annullare. Verranno persi: dati, spese, note e link ai documenti.`);
    if (!ok) return;
    try {
      await db.deleteTrip(t.id);
      state.trips = state.trips.filter(x => x.id !== t.id);
      closeTripModal();
      renderList();
      renderStats();
      updateGlobePoints();
    } catch (e) {
      alert('Errore nell\'eliminazione: ' + (e?.message || e));
    }
  });
}

function closeTripModal() {
  document.getElementById('trip-modal').classList.add('hidden');
  state.openTripId = null;
  updateGlobePoints();
  renderList();
}

/* ============== NEW TRIP FORM ============== */
function openNewTripModal() {
  document.getElementById('new-trip-form').reset();
  document.getElementById('loc-lat').value = '';
  document.getElementById('loc-lng').value = '';
  document.getElementById('loc-country').value = '';
  document.getElementById('location-suggestions').classList.remove('open');
  document.getElementById('new-trip-modal').classList.remove('hidden');
}
function closeNewTripModal() {
  document.getElementById('new-trip-modal').classList.add('hidden');
}

// Location autocomplete (Nominatim)
let locDebounce = null;
function setupLocationAutocomplete() {
  const input = document.getElementById('location-input');
  const box = document.getElementById('location-suggestions');

  input.addEventListener('input', () => {
    const q = input.value.trim();
    document.getElementById('loc-lat').value = '';
    document.getElementById('loc-lng').value = '';
    if (locDebounce) clearTimeout(locDebounce);
    if (q.length < 3) { box.classList.remove('open'); return; }
    locDebounce = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'it' } });
        const data = await res.json();
        box.innerHTML = data.map(r => {
          const cc = (r.address?.country_code || '').toUpperCase();
          const name = r.display_name.split(',').slice(0, 2).join(',').trim();
          return `<div class="location-suggestion" data-lat="${r.lat}" data-lng="${r.lon}" data-cc="${cc}" data-country="${escapeHtml(r.address?.country || '')}" data-name="${escapeHtml(name)}">
            <span class="sug-flag">${flagEmoji(cc)}</span>
            <div class="sug-name">${escapeHtml(name)}</div>
            <div class="sug-country">${escapeHtml(r.address?.country || '')}</div>
          </div>`;
        }).join('');
        box.classList.toggle('open', data.length > 0);

        box.querySelectorAll('.location-suggestion').forEach(item => {
          item.addEventListener('click', () => {
            input.value = item.dataset.name;
            document.getElementById('loc-lat').value = item.dataset.lat;
            document.getElementById('loc-lng').value = item.dataset.lng;
            document.getElementById('loc-country').value = item.dataset.country;
            input.dataset.cc = item.dataset.cc;
            box.classList.remove('open');
          });
        });
      } catch (e) { console.warn('geocoding fail', e); }
    }, 400);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.location-field')) box.classList.remove('open');
  });
}

async function submitNewTrip(e) {
  e.preventDefault();
  const f = e.target;
  const title = f.title.value.trim();
  const location = f.location.value.trim();
  const start = f.start_date.value;
  const end = f.end_date.value;
  const notes = f.notes.value.trim();
  let lat = parseFloat(f.lat.value), lng = parseFloat(f.lng.value);
  let country = f.country.value;
  let country_code = document.getElementById('location-input').dataset.cc || '';

  if (isNaN(lat) || isNaN(lng)) {
    // ultimo tentativo: cerca usando il testo immesso
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1&addressdetails=1`);
      const data = await r.json();
      if (data[0]) {
        lat = +data[0].lat; lng = +data[0].lon;
        country = data[0].address?.country || '';
        country_code = (data[0].address?.country_code || '').toUpperCase();
      } else {
        alert('Non sono riuscito a trovare la posizione. Riprova selezionando un suggerimento.');
        return;
      }
    } catch { alert('Errore di rete nel cercare la posizione.'); return; }
  }

  const today = new Date().toISOString().slice(0, 10);
  const category = start > today ? 'future' : 'past';

  const newTrip = {
    id: crypto.randomUUID().replace(/-/g, '').slice(0, 32),
    title, location_name: location, lat, lng, country, country_code,
    start_date: start, end_date: end,
    category,
    expenses: [],
    expenses_total_eur: 0,
    notes: notes ? [{ heading: 'Note', body: notes }] : [],
    pdf_filenames: [],
  };

  await db.saveTrip(newTrip);
  state.trips.push(newTrip);
  closeNewTripModal();
  updateGlobePoints();
  renderList();
  renderStats();
  setTimeout(() => openTripModal(newTrip.id), 200);
}

/* ============== ESCAPE HTML ============== */
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

/* ============== INIT ============== */
async function init() {
  initGlobe();
  state.trips = await db.loadTrips();
  document.getElementById('loader').classList.add('gone');
  setTimeout(() => document.getElementById('loader').remove(), 500);
  updateGlobePoints();
  renderList();
  renderStats();

  // Filters
  document.querySelectorAll('#filter-pills .pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('#filter-pills .pill').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      state.filter = p.dataset.filter;
      updateGlobePoints();
      renderList();
    });
  });

  // Search
  document.getElementById('search').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderList();
  });

  // New trip
  document.getElementById('btn-new-trip').addEventListener('click', openNewTripModal);
  document.getElementById('new-trip-modal-close').addEventListener('click', closeNewTripModal);
  document.getElementById('cancel-new-trip').addEventListener('click', closeNewTripModal);
  document.getElementById('new-trip-form').addEventListener('submit', submitNewTrip);
  setupLocationAutocomplete();

  // Trip modal close
  document.getElementById('trip-modal-close').addEventListener('click', closeTripModal);
  document.getElementById('trip-modal').addEventListener('click', (e) => {
    if (e.target.id === 'trip-modal') closeTripModal();
  });
  document.getElementById('new-trip-modal').addEventListener('click', (e) => {
    if (e.target.id === 'new-trip-modal') closeNewTripModal();
  });

  // Esc closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeTripModal(); closeNewTripModal(); }
  });
}

init();
