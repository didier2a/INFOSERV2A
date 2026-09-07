import {currentAndNext, eventStatus, incompleteFacts, nearestPlaces, walkUrl} from './trip-model.js';

export const SCREENS = ['now', 'program', 'map', 'places', 'carnet', 'place-sheet'];

export const SANTA_TERESA_ORIGIN = {lat: 41.24016, lng: 9.18869};

export function simulateScreens(trip, now = new Date()) {
  const {current, next, todayDate, nowMinutes, events} = currentAndNext(trip, now);
  const focus = current || next;
  const place = trip.places.find((item) => item.id === focus?.placeId) || null;
  return {
    now: {
      kicker: current ? 'En cours' : next ? 'Prochaine étape' : 'Séjour',
      title: focus?.title || trip.trip.title,
      place: place?.name || focus?.place || null,
      calendarUrl: focus?.calendarUrl || null,
      heroImage: place?.heroImage || null,
      upcomingCount: events.filter((event) => eventStatus(event, {dayDate: event.dayDate, todayDate, nowMinutes}) !== 'done').length
    },
    program: trip.days.map((day) => ({
      date: day.date,
      label: day.label,
      events: day.events.map((event) => ({
        title: event.title,
        status: eventStatus(event, {dayDate: day.date, todayDate, nowMinutes}),
        placeId: event.placeId,
        calendarUrl: event.calendarUrl
      }))
    })),
    map: {
      markers: trip.places.map((item) => ({id: item.id, lat: item.lat, lng: item.lng, waze: item.waze})),
      routes: trip.routes || [],
      nearestFromCenter: nearestPlaces(trip.places, SANTA_TERESA_ORIGIN, 3).map(({place: item}) => item.id)
    },
    places: trip.places.map((item) => ({
      id: item.id,
      name: item.name,
      heroImage: item.heroImage,
      waze: item.waze,
      walk: walkUrl(item),
      photoCredit: item.photoCredit || null
    })),
    carnet: {
      discover: (trip.discover || []).map((card) => card.placeId),
      checklist: trip.checklist || [],
      playlist: (trip.playlist || []).map((track) => ({
        title: track.title,
        youtube: Boolean(track.youtube),
        spotify: Boolean(track.spotify)
      })),
      facts: incompleteFacts()
    }
  };
}

export function requiredPhotoFiles(trip) {
  return [...new Set([
    ...trip.places.map((place) => place.heroImage),
    ...(trip.discover || []).map((card) => card.image),
    trip.media?.offlineMap
  ].filter(Boolean))];
}
