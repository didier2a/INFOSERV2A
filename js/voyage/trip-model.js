const TYPE_ICON = {
  transfert: '🚢',
  balade: '🥾',
  repas: '🍝',
  marche: '🚶',
  bus: '🚌',
  plage: '🏖️',
  pause: '☕'
};

export function typeIcon(type) {
  return TYPE_ICON[type] || '📍';
}

export function indexPlaces(trip) {
  return Object.fromEntries((trip.places || []).map((place) => [place.id, place]));
}

export function toMinutes(time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
}

export function fromMinutes(value) {
  const normalized = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

export function durationMinutes(event) {
  let value = toMinutes(event.end) - toMinutes(event.time);
  if (value < 0) value += 1440;
  return value;
}

export function localParts(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(date).map((part) => [part.type, part.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    minutes: toMinutes(`${parts.hour}:${parts.minute}`)
  };
}

export function eventStatus(event, {dayDate, todayDate, nowMinutes}) {
  if (dayDate < todayDate) return 'done';
  if (dayDate > todayDate) return 'upcoming';
  if (toMinutes(event.end) <= nowMinutes) return 'done';
  if (toMinutes(event.time) <= nowMinutes) return 'current';
  return 'upcoming';
}

export function flattenEvents(trip) {
  return (trip.days || []).flatMap((day) =>
    (day.events || []).map((event, index) => ({
      ...event,
      dayDate: day.date,
      dayLabel: day.label,
      daySubtitle: day.subtitle,
      index
    }))
  );
}

export function currentAndNext(trip, now = new Date()) {
  const timeZone = trip.trip?.timezone || 'Europe/Rome';
  const {date: todayDate, minutes: nowMinutes} = localParts(now, timeZone);
  const events = flattenEvents(trip);
  const current = events.find((event) => eventStatus(event, {dayDate: event.dayDate, todayDate, nowMinutes}) === 'current') || null;
  const next = events.find((event) => {
    if (event.dayDate > todayDate) return true;
    return event.dayDate === todayDate && toMinutes(event.time) > nowMinutes;
  }) || null;
  return {todayDate, nowMinutes, current, next, events};
}

export function haversineKm(from, to) {
  const radius = 6371;
  const rad = (value) => (value * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km) {
  if (km == null || Number.isNaN(km)) return 'Distance inconnue';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function nearestPlaces(places, origin, limit = 3) {
  if (!origin) return [];
  return [...places]
    .map((place) => ({place, km: haversineKm(origin, place)}))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

export function walkUrl(place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=walking`;
}

export function incompleteFacts() {
  return [
    {label: 'Hôtel', value: 'À compléter'},
    {label: 'Ferry Bonifacio ⇄ Santa Teresa', value: 'À compléter'},
    {label: 'Restaurants retenus', value: 'À compléter'}
  ];
}
