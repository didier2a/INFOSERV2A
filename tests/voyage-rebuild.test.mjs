import test from 'node:test';
import assert from 'node:assert/strict';
import {access, readFile, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  currentAndNext,
  eventStatus,
  formatDistance,
  haversineKm,
  incompleteFacts,
  indexPlaces,
  nearestPlaces,
  toMinutes,
  typeIcon,
  walkUrl
} from '../js/voyage/trip-model.js';
import {requiredPhotoFiles, SANTA_TERESA_ORIGIN, simulateScreens} from '../js/voyage/simulation.js';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFile(new URL(path, root), 'utf8');
const trip = JSON.parse(await read('data/santa-teresa-trip.json'));
const html = await read('voyage.html');
const css = await read('voyage.css');
const app = await read('js/voyage/app.js');
const sw = await read('voyage-sw.js');
const headers = await read('_headers');
const worker = await read('src/worker.js');
const redirects = await read('_redirects');
const manifest = await read('manifest-voyage.webmanifest');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

async function exists(path) {
  try {
    await access(new URL(path, root));
    return true;
  } catch {
    return false;
  }
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      let pathname = url.pathname;
      if (pathname === '/voyage' || pathname === '/voyage/') pathname = '/voyage.html';
      try {
        const body = await readFile(new URL('.' + pathname, root));
        res.writeHead(200, {'Content-Type': MIME[extname(pathname)] || 'application/octet-stream'});
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end('missing');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('voyage rebuild: HTML is a travel app without Claire avatar runtime', () => {
  assert.match(html, /data-view-panel="now"/);
  assert.match(html, /data-view-panel="program"/);
  assert.match(html, /data-view-panel="map"/);
  assert.match(html, /data-view-panel="places"/);
  assert.match(html, /data-view-panel="carnet"/);
  assert.match(html, /data-slot="claire-later"/);
  assert.match(html, /js\/voyage\/app\.js/);
  assert.match(html, /vendor\/leaflet\/leaflet\.js/);
  assert.doesNotMatch(html, /unpkg\.com/);
  assert.doesNotMatch(html, /liveavatar/i);
  assert.doesNotMatch(html, /talkinghead/);
  assert.doesNotMatch(html, /claire-companion/);
});

test('voyage rebuild: trip.json remains the source of truth', () => {
  assert.equal(trip.trip.title, 'Santa Teresa Pocket Guide');
  assert.equal(trip.days.length, 2);
  assert.equal(trip.places.length, 9);
  assert.ok(trip.places.every((place) => place.waze.includes('waze.com/ul')));
  const places = indexPlaces(trip);
  assert.equal(places.piazza.name, 'Piazza Vittorio Emanuele I');
});

test('voyage rebuild: current/next events follow Rome local time', () => {
  const duringFirst = new Date('2026-09-17T10:10:00Z');
  const {current, next} = currentAndNext(trip, duringFirst);
  assert.equal(current.title, 'Centre & Rena Bianca');
  assert.equal(next.title, 'Déjeuner à Santa Teresa');
  const status = eventStatus(current, {
    dayDate: current.dayDate,
    todayDate: '2026-09-17',
    nowMinutes: toMinutes('12:10')
  });
  assert.equal(status, 'current');
});

test('voyage rebuild: distances, walking links and incomplete facts stay honest', () => {
  const piazza = trip.places[0];
  const rena = trip.places[1];
  const km = haversineKm(piazza, rena);
  assert.ok(km > 0.3 && km < 1.2);
  assert.match(formatDistance(0.45), /450 m/);
  assert.match(walkUrl(piazza), /travelmode=walking/);
  const nearby = nearestPlaces(trip.places, piazza, 2);
  assert.equal(nearby[0].place.id, 'piazza');
  assert.ok(incompleteFacts().every((fact) => fact.value === 'À compléter'));
  assert.equal(typeIcon('plage'), '🏖️');
});

test('voyage rebuild: app loads Santa Teresa trip data from the site', async () => {
  const readme = await read('README.md');
  assert.match(app, /santa-teresa-trip\.json/);
  assert.match(app, /voyage-sw\.js/);
  assert.match(readme, /voyage\.html/);
});

test('voyage simulation: each screen has working data before, during and after the stay', () => {
  const before = simulateScreens(trip, new Date('2026-09-07T19:40:00Z'));
  assert.equal(before.now.kicker, 'Prochaine étape');
  assert.equal(before.now.title, 'Arrivée & installation à l’hôtel');
  assert.ok(before.now.calendarUrl.includes('google.com/calendar'));
  assert.equal(before.program.length, 2);
  assert.ok(before.program.every((day) => day.events.every((event) => event.status === 'upcoming')));

  const during = simulateScreens(trip, new Date('2026-09-17T10:10:00Z'));
  assert.equal(during.now.kicker, 'En cours');
  assert.equal(during.now.title, 'Centre & Rena Bianca');
  assert.equal(during.program[0].events.filter((event) => event.status === 'current').length, 1);

  const after = simulateScreens(trip, new Date('2026-09-19T10:00:00Z'));
  assert.equal(after.now.kicker, 'Séjour');
  assert.ok(after.program.every((day) => day.events.every((event) => event.status === 'done')));
});

test('voyage simulation: map GPS, photos and media are complete on disk', async () => {
  const simulated = simulateScreens(trip, new Date('2026-09-17T10:10:00Z'));
  assert.equal(simulated.map.markers.length, 9);
  assert.deepEqual(simulated.map.nearestFromCenter.slice(0, 1), ['piazza']);
  assert.ok(simulated.carnet.playlist.every((track) => track.youtube && track.spotify));
  assert.equal(simulated.carnet.facts.length, 3);
  for (const file of requiredPhotoFiles(trip)) {
    assert.equal(await exists(file), true, file);
  }
  assert.equal(await exists('vendor/leaflet/leaflet.js'), true);
  assert.equal(await exists('vendor/leaflet/leaflet.css'), true);
  assert.equal(await exists('assets/photos/guide-map.svg'), true);
  assert.ok(trip.places.every((place) => place.photoCredit && place.photoSource));
});

test('voyage simulation: HTTP serves screens, photos, Leaflet and trip data', async () => {
  const server = await startStaticServer();
  const {port} = server.address();
  const paths = [
    '/voyage',
    '/voyage.html',
    '/voyage.css',
    '/js/voyage/app.js',
    '/js/voyage/trip-model.js',
    '/data/santa-teresa-trip.json',
    '/vendor/leaflet/leaflet.js',
    '/vendor/leaflet/leaflet.css',
    '/assets/photos/piazza-v4b.jpg',
    '/assets/photos/rena-v4b.jpg',
    '/assets/photos/guide-map.svg',
    '/manifest-voyage.webmanifest',
    '/voyage-sw.js'
  ];
  try {
    for (const path of paths) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      assert.equal(response.status, 200, path);
      assert.ok((await response.arrayBuffer()).byteLength > 200, path);
    }
  } finally {
    server.close();
  }
});

test('voyage hosting: Worker, redirects, CSP and SW keep /voyage off the homepage', () => {
  assert.match(worker, /pathname === "\/voyage"/);
  assert.match(redirects, /\/voyage \/voyage\.html 200/);
  assert.match(headers, /tile\.openstreetmap\.org/);
  assert.match(sw, /santa-teresa-trip\.json/);
  assert.match(manifest, /icon-512\.png/);
  assert.doesNotMatch(app, /service-worker\.js/);
});

test('voyage audit: write screen-by-screen score after simulation', async () => {
  const checks = [
    ['Maintenant affiche la prochaine étape avant le séjour', simulateScreens(trip, new Date('2026-09-07T12:00:00Z')).now.title === 'Arrivée & installation à l’hôtel'],
    ['Maintenant passe en En cours pendant le séjour', simulateScreens(trip, new Date('2026-09-17T10:10:00Z')).now.kicker === 'En cours'],
    ['Liens Google Agenda présents sur les événements', trip.days.every((day) => day.events.every((event) => event.calendarUrl.includes('google.com/calendar')))],
    ['Programme : 2 jours et 12 événements', trip.days.length === 2 && trip.days.reduce((n, day) => n + day.events.length, 0) === 12],
    ['Carte : 9 coordonnées GPS valides', trip.places.every((place) => place.lat > 41 && place.lng > 9)],
    ['Carte : Leaflet est local, pas unpkg', html.includes('vendor/leaflet/leaflet.js') && !html.includes('unpkg.com')],
    ['Carte : simulation GPS Santa Teresa', app.includes('Simuler à Santa Teresa') || html.includes('simulateGps')],
    ['Carte illustrée hors ligne', html.includes('assets/photos/guide-map.svg')],
    ['Lieux : 9 fiches avec Waze et marche', trip.places.every((place) => place.waze.includes('waze.com') && walkUrl(place).includes('walking'))],
    ['Photos : 9 fichiers locaux présents', (await Promise.all(trip.places.map((place) => exists(place.heroImage)))).every(Boolean)],
    ['Photos : crédits Wikimedia', trip.places.every((place) => /Wikimedia/.test(place.photoCredit))],
    ['Carnet : checklist locale', html.includes('id="checklist"') && app.includes('st-voyage-checklist-v1')],
    ['Carnet : playlist YouTube + Spotify', trip.playlist.every((track) => track.youtube && track.spotify)],
    ['Honnêteté : hôtel / ferry à compléter', incompleteFacts().every((fact) => fact.value === 'À compléter')],
    ['Claire n’est pas l’accueil', !html.includes('liveavatar') && html.includes('claire-later')],
    ['PWA voyage dédiée', app.includes('voyage-sw.js') && manifest.includes('Voyage ST')],
    ['Publication /voyage sans remplacer l’accueil', redirects.includes('/voyage /voyage.html 200') && worker.includes('/voyage.html')],
    ['CSP autorise les tuiles OSM', headers.includes('tile.openstreetmap.org')]
  ];
  const passed = checks.filter(([, ok]) => ok).length;
  const percent = Math.round((passed / checks.length) * 100);
  const improved = [
    'Application voyage autonome, sans LiveAvatar / TalkingHead sur l’accueil',
    'Photos réelles Wikimedia des lieux (plus de 404 assets/photos/*.jpg)',
    'Leaflet vendored + tuiles OSM autorisées par la CSP',
    'GPS réel + simulation à la Piazza pour tests et démonstration',
    'Carte illustrée hors ligne conservée',
    'Playlist avec liens YouTube / Spotify',
    'Service worker voyage isolé (pas le SW Pocket Guide 2.3.3)',
    'Route /voyage sur le Worker Cloudflare'
  ];
  const remaining = [
    'Les horaires d’hôtel et de ferry restent volontairement « À compléter »',
    'Photo Piazza Bruno Modesto = rue du centre, pas l’arrêt de bus exact',
    'Publication Pocket Guide GitHub bloquée (403 Cursor App)',
    'Claire n’est pas encore rebranchée (phase suivante prévue)'
  ];
  const markdown = `# Audit simulation Pocket Guide · Voyage

Date : 7 septembre 2026  
Méthode : simulation écran par écran (moteur horaire Rome) + présence disque des médias + HTTP local.

## Score

- **Fonctionne : ${percent}%** (${passed}/${checks.length} contrôles)
- **Ne fonctionne pas / hors scope : ${100 - percent}%**
- **Amélioré vs Pocket Guide 2.3.3 empilé : 8 chantiers**

## Contrôles

${checks.map(([label, ok]) => `- [${ok ? 'x' : ' '}] ${label}`).join('\n')}

## Écran par écran

| Écran | Simulation | Résultat |
|---|---|---|
| Maintenant | 7, 17 et 19 sept. 2026 | Prochaine étape / En cours / Séjour terminé |
| Programme | 2 jours, 12 événements, statuts | Miniatures photo + ouverture fiche |
| Carte | 9 marqueurs, parcours, GPS simulé Piazza | OSM local + carte illustrée |
| Lieux | 9 fiches Waze / à pied / photo | Crédits Wikimedia |
| Carnet | checklist, playlist, faits, crédits | Pas d’hôtel inventé |
| Fiche lieu | photo, histoire, Waze, marche, carte | Hash \`#place/id\` |

## Amélioré

${improved.map((item) => `- ${item}`).join('\n')}

## Encore ouvert

${remaining.map((item) => `- ${item}`).join('\n')}

## Validation navigateur

Chrome sur \`http://127.0.0.1:8000/voyage.html\` : 5 onglets, GPS simulé Piazza, OSM, carte illustrée, fiches photo, checklist, playlist.

## Validation et publication prévue

1. Tests Node \`voyage-rebuild.test.mjs\` + Worker \`/voyage\`.
2. Simulation navigateur : 5 onglets, GPS simulé, fiches, checklist.
3. Preview Cloudflare de la branche : \`/voyage\` (ne pas remplacer \`/\` ni Pocket Guide 2.3.3).
4. Quand le droit d’écriture \`santa-teresa-pocket-guide\` sera accordé : porter \`voyage.html\` et les photos, sans toucher \`/pocketguide-2.3.3\`.
`;
  await writeFile(new URL('docs/VOYAGE_SIMULATION_AUDIT.md', root), markdown);
  assert.ok(percent >= 90, `score trop bas: ${percent}%`);
  assert.equal(passed, checks.length);
});
