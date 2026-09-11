import {
  currentAndNext,
  eventStatus,
  formatDistance,
  haversineKm,
  incompleteFacts,
  indexPlaces,
  localParts,
  nearestPlaces,
  typeIcon,
  walkUrl
} from './trip-model.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const CHECKLIST_KEY = 'st-voyage-checklist-v1';
const VIEWS = ['now', 'program', 'map', 'places', 'carnet'];
const SANTA_TERESA = {lat: 41.24016, lng: 9.18869};

let trip;
let placesById;
let timeZone = 'Europe/Rome';
let timeFmt;
let selectedDay;
let map;
let routeLayer;
let markers = [];
let userMarker;
let watchId = null;
let userPosition = null;
let gpsMode = null;
let mapMode = 'interactive';
let activePlaceId = null;
let checklist = {};

boot().catch((error) => {
  const banner = $('#bootError');
  banner.hidden = false;
  banner.textContent = `Le guide n’a pas pu démarrer : ${error.message}`;
});

async function boot() {
  const response = await fetch('./data/santa-teresa-trip.json', {cache: 'no-cache'});
  if (!response.ok) throw new Error('données du séjour indisponibles');
  trip = await response.json();
  placesById = indexPlaces(trip);
  timeZone = trip.trip?.timezone || 'Europe/Rome';
  timeFmt = new Intl.DateTimeFormat('fr-FR', {timeZone, hour: '2-digit', minute: '2-digit'});
  selectedDay = chooseInitialDay();
  checklist = loadChecklist();

  $('#tripTitle').textContent = trip.trip.title;
  $('#tripMeta').textContent = `${trip.trip.start} → ${trip.trip.end} · ${trip.trip.travelers} voyageurs · ${timeZone}`;
  renderClock();
  renderNow();
  renderDays();
  renderProgram();
  renderPlaces();
  renderDiscover();
  renderPlaylist();
  renderChecklist();
  renderFacts();
  renderCredits();
  bindNav();
  bindProgram();
  bindGps();
  bindMapChrome();
  bindInstall();
  showView(viewFromLocation(), {replaceHash: true});
  window.addEventListener('hashchange', () => showView(viewFromLocation(), {replaceHash: true}));
  setInterval(renderClock, 30000);
  setInterval(renderNow, 60000);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./voyage-sw.js', {updateViaCache: 'none'}).catch(() => {});
  }
}

function chooseInitialDay() {
  const today = localParts(new Date(), timeZone).date;
  return trip.days.some((day) => day.date === today) ? today : trip.days[0].date;
}

function loadChecklist() {
  try {
    return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || 'null') || Object.fromEntries((trip.checklist || []).map((item) => [item, false]));
  } catch {
    return Object.fromEntries((trip.checklist || []).map((item) => [item, false]));
  }
}

function saveChecklist() {
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(checklist));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

function placeFor(event) {
  return placesById[event?.placeId] || null;
}

function photoOf(place) {
  return place?.heroImage || 'assets/photos/guide-map.svg';
}

function viewFromLocation() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (hash.startsWith('place/')) {
    const placeId = hash.slice(6);
    if (placesById[placeId]) queueMicrotask(() => openPlaceSheet(placeId, {fromHash: true}));
    return 'places';
  }
  return VIEWS.includes(hash) ? hash : 'now';
}

function renderClock() {
  $('#localClock').textContent = timeFmt.format(new Date());
}

function renderNow() {
  const {current, next, todayDate, nowMinutes, events} = currentAndNext(trip);
  const focus = current || next;
  const place = placeFor(focus);
  const status = focus
    ? eventStatus(focus, {dayDate: focus.dayDate, todayDate, nowMinutes})
    : 'upcoming';
  $('#nowKicker').textContent = current ? 'En cours' : next ? 'Prochaine étape' : 'Séjour';
  $('#nowTitle').textContent = focus?.title || trip.trip.title;
  $('#nowPlace').textContent = focus?.place || place?.name || 'Santa Teresa di Gallura';
  $('#nowTime').textContent = focus ? `${focus.time} – ${focus.end}` : `${trip.trip.start} → ${trip.trip.end}`;
  $('#nowStatus').textContent = status === 'current' ? 'Maintenant' : status === 'done' ? 'Terminé' : 'À venir';
  $('#nowStory').textContent = place?.description || trip.days.find((day) => day.date === (focus?.dayDate || selectedDay))?.subtitle || '';
  const hero = $('#nowHero');
  const heroImg = $('#nowHeroImg');
  if (place) {
    hero.hidden = false;
    heroImg.src = photoOf(place);
    heroImg.alt = place.name;
    heroImg.onerror = () => { hero.hidden = true; };
  } else {
    hero.hidden = true;
  }
  const openPlace = $('#openNowPlace');
  openPlace.hidden = !place;
  openPlace.onclick = () => place && openPlaceSheet(place.id);
  const calendar = $('#openNowCalendar');
  if (focus?.calendarUrl) {
    calendar.hidden = false;
    calendar.href = focus.calendarUrl;
  } else {
    calendar.hidden = true;
  }
  const upcoming = events.filter((event) => {
    if (focus && event.dayDate === focus.dayDate && event.time === focus.time && event.title === focus.title) return false;
    if (event.dayDate > todayDate) return true;
    return event.dayDate === todayDate && eventStatus(event, {dayDate: event.dayDate, todayDate, nowMinutes}) !== 'done';
  }).slice(0, 3);
  $('#upcomingList').innerHTML = upcoming.map((event) => {
    const itemPlace = placeFor(event);
    return `
      <button type="button" class="upcoming-card" data-place="${escapeHtml(event.placeId || '')}">
        <img class="timeline-thumb" src="${escapeHtml(photoOf(itemPlace))}" alt="" width="72" height="64">
        <span>
          <strong>${escapeHtml(event.title)}</strong>
          <small>${escapeHtml(event.time)} · ${escapeHtml(event.place || itemPlace?.name || '')}</small>
        </span>
        <span class="timeline-state">À venir</span>
      </button>
    `;
  }).join('') || '<p class="muted">Le séjour est terminé — le carnet et les lieux restent disponibles.</p>';
}

function renderDays() {
  const host = $('#daySwitch');
  host.innerHTML = trip.days.map((day) => `
    <button type="button" class="chip ${day.date === selectedDay ? 'is-active' : ''}" data-day="${day.date}">
      <strong>${escapeHtml(day.label)}</strong>
      <small>${escapeHtml(day.subtitle)}</small>
    </button>
  `).join('');
}

function renderProgram() {
  const {todayDate, nowMinutes} = currentAndNext(trip);
  const day = trip.days.find((item) => item.date === selectedDay);
  $('#programTitle').textContent = day.label;
  $('#programSubtitle').textContent = day.subtitle;
  $('#timeline').innerHTML = day.events.map((event) => {
    const status = eventStatus(event, {dayDate: day.date, todayDate, nowMinutes});
    const place = placeFor(event);
    return `
      <article class="timeline-item is-${status}" data-place="${escapeHtml(event.placeId || '')}">
        <img class="timeline-thumb" src="${escapeHtml(photoOf(place))}" alt="" width="72" height="64">
        <div class="timeline-copy">
          <strong>${typeIcon(event.type)} ${escapeHtml(event.title)}</strong>
          <small>${escapeHtml(event.time)}–${escapeHtml(event.end)} · ${escapeHtml(event.place || place?.name || '')}</small>
        </div>
        <span class="timeline-state">${status === 'current' ? 'En cours' : status === 'done' ? 'Fait' : 'À venir'}</span>
      </article>
    `;
  }).join('');
}

function renderPlaces() {
  $('#placesList').innerHTML = trip.places.map((place) => `
    <button type="button" class="place-card" data-place="${escapeHtml(place.id)}">
      <img src="${escapeHtml(photoOf(place))}" alt="${escapeHtml(place.name)}" width="640" height="360">
      <span>
        <strong>${escapeHtml(place.icon || '')} ${escapeHtml(place.name)}</strong>
        <small>${escapeHtml(place.note || place.description || '')}</small>
      </span>
    </button>
  `).join('');
}

function renderDiscover() {
  $('#discoverCards').innerHTML = (trip.discover || []).map((card) => {
    const place = placesById[card.placeId];
    return `
      <button type="button" class="discover-card" data-place="${escapeHtml(card.placeId)}">
        <img src="${escapeHtml(card.image || photoOf(place))}" alt="${escapeHtml(card.title)}">
        <strong>${escapeHtml(card.icon || '')} ${escapeHtml(card.title)}</strong>
        <small>${escapeHtml(card.text)}</small>
      </button>
    `;
  }).join('');
}

function renderPlaylist() {
  $('#playlist').innerHTML = (trip.playlist || []).map((track) => `
    <article class="track">
      <div>
        <strong>${escapeHtml(track.title)}</strong>
        <small>${escapeHtml(track.artist)} · ${escapeHtml(track.moment)}</small>
      </div>
      <div class="track-links">
        ${track.youtube ? `<a class="action" href="${escapeHtml(track.youtube)}" target="_blank" rel="noopener">YouTube</a>` : ''}
        ${track.spotify ? `<a class="action" href="${escapeHtml(track.spotify)}" target="_blank" rel="noopener">Spotify</a>` : ''}
      </div>
    </article>
  `).join('');
}

function renderChecklist() {
  $('#checklist').innerHTML = (trip.checklist || []).map((item) => `
    <label class="check-item">
      <input type="checkbox" data-item="${escapeHtml(item)}" ${checklist[item] ? 'checked' : ''}>
      <span>${escapeHtml(item)}</span>
    </label>
  `).join('');
}

function renderFacts() {
  $('#facts').innerHTML = incompleteFacts().map((fact) => `
    <article class="fact">
      <small>${escapeHtml(fact.label)}</small>
      <strong>${escapeHtml(fact.value)}</strong>
    </article>
  `).join('');
}

function renderCredits() {
  $('#photoNote').textContent = trip.media?.photoNote || '';
  $('#photoCredits').innerHTML = trip.places.map((place) => `
    <article>
      <small>${escapeHtml(place.name)}</small>
      <strong>${escapeHtml(place.photoCredit || 'Crédit à préciser')}</strong>
      ${place.photoSource ? `<a class="source" href="${escapeHtml(place.photoSource)}" target="_blank" rel="noopener">Wikimedia</a>` : ''}
    </article>
  `).join('');
}

function bindNav() {
  $$('[data-view-target]').forEach((button) => {
    button.addEventListener('click', () => showView(button.dataset.viewTarget));
  });
  $('#app').addEventListener('click', (event) => {
    const node = event.target.closest('[data-place]');
    if (!node || node.closest('#timeline')) return;
    if (node.dataset.place) openPlaceSheet(node.dataset.place);
  });
  $('#closePlace').addEventListener('click', () => {
    $('#placeDialog').close();
    if (location.hash.startsWith('#place/')) history.replaceState(null, '', `#${$('#app').dataset.view}`);
  });
  $('#jumpToMap').addEventListener('click', () => showView('map'));
}

function bindProgram() {
  $('#daySwitch').addEventListener('click', (event) => {
    const button = event.target.closest('[data-day]');
    if (!button) return;
    selectedDay = button.dataset.day;
    renderDays();
    renderProgram();
    if (map) drawRoute();
  });
  $('#timeline').addEventListener('click', (event) => {
    const item = event.target.closest('[data-place]');
    if (item?.dataset.place) openPlaceSheet(item.dataset.place);
  });
  $('#checklist').addEventListener('change', (event) => {
    const input = event.target.closest('input[data-item]');
    if (!input) return;
    checklist[input.dataset.item] = input.checked;
    saveChecklist();
  });
}

function showView(name, {replaceHash = false} = {}) {
  if (!VIEWS.includes(name)) name = 'now';
  $$('[data-view-panel]').forEach((panel) => {
    const active = panel.dataset.viewPanel === name;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
  $$('[data-view-target]').forEach((button) => {
    const active = button.dataset.viewTarget === name;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $('#app').dataset.view = name;
  const hash = `#${name}`;
  if (replaceHash || location.hash !== hash) {
    history.replaceState(null, '', hash);
  }
  if (name === 'map') {
    setMapMode(mapMode);
    if (mapMode === 'interactive') ensureMap();
  }
}

function bindMapChrome() {
  $('#tabInteractive').addEventListener('click', () => setMapMode('interactive'));
  $('#tabOffline').addEventListener('click', () => setMapMode('offline'));
  $('#fitRoute').addEventListener('click', () => {
    setMapMode('interactive');
    ensureMap();
    drawRoute(true);
  });
}

function setMapMode(mode) {
  mapMode = mode;
  $('#tabInteractive').classList.toggle('is-active', mode === 'interactive');
  $('#tabOffline').classList.toggle('is-active', mode === 'offline');
  $('#interactiveMapPanel').hidden = mode !== 'interactive';
  $('#offlineMapPanel').hidden = mode !== 'offline';
  if (mode === 'interactive') ensureMap();
}

function ensureMap() {
  if (!window.L) {
    $('#gpsStatus').hidden = false;
    $('#gpsStatusText').textContent = 'Carte indisponible';
    $('#gpsMeta').textContent = 'Leaflet n’a pas chargé.';
    return;
  }
  if (map) {
    map.invalidateSize();
    return;
  }
  L.Icon.Default.mergeOptions({
    iconUrl: 'vendor/leaflet/images/marker-icon.png',
    iconRetinaUrl: 'vendor/leaflet/images/marker-icon-2x.png',
    shadowUrl: 'vendor/leaflet/images/marker-shadow.png'
  });
  map = L.map('map', {zoomControl: true, attributionControl: true}).setView([SANTA_TERESA.lat, SANTA_TERESA.lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  trip.places.forEach((place) => {
    const marker = L.marker([place.lat, place.lng], {
      icon: L.divIcon({
        className: '',
        html: `<span class="poi-pin" title="${escapeHtml(place.name)}">${place.icon || '📍'}</span>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      })
    }).addTo(map).bindPopup(`<strong>${escapeHtml(place.name)}</strong><br>${escapeHtml(place.note || '')}`);
    marker.on('click', () => openPlaceSheet(place.id));
    markers.push(marker);
  });
  drawRoute(true);
}

function drawRoute(fit = false) {
  if (!map) return;
  const dayRoute = (trip.routes || []).find((route) => route.day === selectedDay);
  const points = (dayRoute?.points || [])
    .map((id) => placesById[id])
    .filter(Boolean)
    .map((place) => [place.lat, place.lng]);
  if (routeLayer) routeLayer.remove();
  if (!points.length) return;
  routeLayer = L.polyline(points, {color: '#79dccf', weight: 4, opacity: 0.85}).addTo(map);
  if (fit) map.fitBounds(routeLayer.getBounds(), {padding: [28, 28]});
}

function bindGps() {
  $('#locateMe').addEventListener('click', () => {
    if (gpsMode === 'live') {
      stopGps();
      return;
    }
    if (!navigator.geolocation) {
      showGpsStatus('live', 'Géolocalisation indisponible', 'La simulation Santa Teresa reste possible.');
      return;
    }
    stopGps();
    showGpsStatus('live', 'GPS en cours', 'En attente de la première position…');
    $('#locateMe').textContent = 'Arrêter le GPS';
    watchId = navigator.geolocation.watchPosition(
      (position) => applyPosition(position.coords.latitude, position.coords.longitude, position.coords.accuracy, 'live'),
      () => showGpsStatus('live', 'Position refusée', 'Utilisez « Simuler à Santa Teresa » pour tester la carte.'),
      {enableHighAccuracy: true, maximumAge: 8000, timeout: 12000}
    );
    gpsMode = 'live';
  });
  $('#simulateGps').addEventListener('click', () => {
    stopGps();
    applyPosition(SANTA_TERESA.lat, SANTA_TERESA.lng, 12, 'sim');
  });
}

function stopGps() {
  if (watchId != null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  gpsMode = null;
  $('#locateMe').textContent = 'Activer ma position';
}

function applyPosition(lat, lng, accuracy, mode) {
  userPosition = {lat, lng};
  gpsMode = mode;
  showGpsStatus(
    mode,
    mode === 'sim' ? 'Position simulée' : 'GPS actif',
    `${mode === 'sim' ? 'Piazza Vittorio Emanuele I · ' : ''}précision ${Math.round(accuracy || 0)} m`
  );
  if (mode === 'live') $('#locateMe').textContent = 'Arrêter le GPS';
  setMapMode('interactive');
  ensureMap();
  if (userMarker) userMarker.setLatLng(userPosition);
  else userMarker = L.circleMarker(userPosition, {radius: 9, color: '#eacb82', fillColor: '#eacb82', fillOpacity: 0.95, weight: 3}).addTo(map);
  map.panTo(userPosition);
  renderNearest();
}

function showGpsStatus(mode, title, meta) {
  $('#gpsStatus').hidden = false;
  $('#gpsStatus').dataset.mode = mode || '';
  $('#gpsStatusText').textContent = title;
  $('#gpsMeta').textContent = meta;
}

function renderNearest() {
  const nearby = nearestPlaces(trip.places, userPosition, 3);
  $('#nearestPanel').hidden = nearby.length === 0;
  $('#nearestPanel').innerHTML = nearby.map(({place, km}) => `
    <button type="button" class="nearest-card" data-place="${escapeHtml(place.id)}">
      <strong>${escapeHtml(place.name)}</strong>
      <small>${formatDistance(km)}</small>
    </button>
  `).join('');
}

function openPlaceSheet(placeId, {fromHash = false} = {}) {
  const place = placesById[placeId];
  if (!place) return;
  activePlaceId = placeId;
  const distance = userPosition ? formatDistance(haversineKm(userPosition, place)) : 'Activez le GPS ou simulez Santa Teresa pour la distance';
  $('#placeDialog').showModal();
  $('#placeContent').innerHTML = `
    <figure class="place-hero"><img src="${escapeHtml(photoOf(place))}" alt="${escapeHtml(place.name)}"></figure>
    <p class="overline">${escapeHtml(place.icon || '')} ${escapeHtml(place.sourceLabel || 'Lieu du séjour')}</p>
    <h2>${escapeHtml(place.name)}</h2>
    <p>${escapeHtml(place.description || place.note || '')}</p>
    <p class="muted">${escapeHtml(place.historyShort || '')}</p>
    <p>${escapeHtml(place.repere || '')}</p>
    <p class="muted">${escapeHtml(distance)}</p>
    <div class="sheet-actions">
      <a class="action action--accent" href="${escapeHtml(walkUrl(place))}" target="_blank" rel="noopener">À pied</a>
      <a class="action" href="${escapeHtml(place.waze)}" target="_blank" rel="noopener">Waze</a>
      <button class="action" type="button" data-show-on-map="${escapeHtml(place.id)}">Voir sur la carte</button>
    </div>
    ${place.sourceUrl ? `<a class="source" href="${escapeHtml(place.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(place.sourceLabel || 'Source')}</a>` : ''}
    ${place.photoCredit ? `<p class="muted">${escapeHtml(place.photoCredit)}</p>` : ''}
  `;
  $('#placeContent').querySelector('[data-show-on-map]')?.addEventListener('click', () => {
    $('#placeDialog').close();
    showView('map');
    ensureMap();
    map.setView([place.lat, place.lng], 16);
    const marker = markers[trip.places.findIndex((item) => item.id === place.id)];
    marker?.openPopup();
  });
  if (!fromHash) history.replaceState(null, '', `#place/${placeId}`);
}

function bindInstall() {
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    $('#installApp').hidden = false;
  });
  $('#installApp').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    $('#installApp').hidden = true;
  });
}
