import type { Coords, Load, LoadStop, StopType } from '../types';

const GOOGLE_WAYPOINT_LIMIT = 9;

export function sortStopsByType(stops: LoadStop[], type: StopType): LoadStop[] {
  return stops.filter((s) => s.type === type).sort((a, b) => a.sequence - b.sequence);
}

export function getOrderedStops(load: Pick<Load, 'stops'> | { stops?: LoadStop[] }): LoadStop[] {
  const stops = load.stops ?? [];
  return [...sortStopsByType(stops, 'pickup'), ...sortStopsByType(stops, 'dropoff')];
}

export function getRoutePolyline(
  load: Pick<Load, 'stops'> & { originCoords?: Coords; destCoords?: Coords }
): Coords[] {
  const ordered = getOrderedStops(load);
  if (ordered.length > 0) {
    return ordered.map((s) => s.coords);
  }
  if (load.originCoords && load.destCoords) {
    return [load.originCoords, load.destCoords];
  }
  return [];
}

export function getLoadSummaryLabels(
  load: Pick<Load, 'stops' | 'origin' | 'destination' | 'originCoords' | 'destCoords'>
): {
  origin: string;
  destination: string;
  originCoords: Coords;
  destCoords: Coords;
} {
  const ordered = getOrderedStops(load);
  const pickups = sortStopsByType(ordered, 'pickup');
  const dropoffs = sortStopsByType(ordered, 'dropoff');

  if (pickups.length > 0 && dropoffs.length > 0) {
    const firstPickup = pickups[0];
    const lastDropoff = dropoffs[dropoffs.length - 1];
    return {
      origin: firstPickup.address,
      destination: lastDropoff.address,
      originCoords: firstPickup.coords,
      destCoords: lastDropoff.coords,
    };
  }

  return {
    origin: load.origin,
    destination: load.destination,
    originCoords: load.originCoords,
    destCoords: load.destCoords,
  };
}

export function normalizeLoadFromFirestore(data: Record<string, unknown>): {
  stops: LoadStop[];
  origin: string;
  destination: string;
  originCoords: Coords;
  destCoords: Coords;
} {
  const rawStops = data.stops as LoadStop[] | undefined;
  const origin = data.origin as string;
  const destination = data.destination as string;
  const originCoords = data.originCoords as Coords;
  const destCoords = data.destCoords as Coords;

  if (rawStops && rawStops.length > 0) {
    const summary = getLoadSummaryLabels({
      stops: rawStops,
      origin,
      destination,
      originCoords,
      destCoords,
    });
    return {
      stops: rawStops,
      origin: summary.origin,
      destination: summary.destination,
      originCoords: summary.originCoords,
      destCoords: summary.destCoords,
    };
  }

  const stops: LoadStop[] = [
    {
      type: 'pickup',
      address: origin,
      coords: originCoords,
      sequence: 0,
    },
    {
      type: 'dropoff',
      address: destination,
      coords: destCoords,
      sequence: 0,
    },
  ];

  return { stops, origin, destination, originCoords, destCoords };
}

function formatCoords(coords: Coords): string {
  return `${coords.latitude},${coords.longitude}`;
}

function formatAddressOrCoords(stop: LoadStop): string {
  return encodeURIComponent(stop.address || formatCoords(stop.coords));
}

export function buildGoogleMapsDirectionsUrl(stops: LoadStop[]): string | null {
  const ordered = getOrderedStops({ stops });
  if (ordered.length < 2) return null;

  const origin = formatAddressOrCoords(ordered[0]);
  const destination = formatAddressOrCoords(ordered[ordered.length - 1]);
  const middle = ordered.slice(1, -1);

  const params = new URLSearchParams({
    api: '1',
    origin,
    destination,
    travelmode: 'driving',
  });

  if (middle.length > 0) {
    const waypoints = middle
      .slice(0, GOOGLE_WAYPOINT_LIMIT)
      .map((s) => formatAddressOrCoords(s))
      .join('|');
    params.set('waypoints', waypoints);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildAppleMapsDirectionsUrl(stops: LoadStop[]): string | null {
  const ordered = getOrderedStops({ stops });
  if (ordered.length < 2) return null;

  const params = new URLSearchParams({ dirflg: 'd' });
  params.set('saddr', formatCoords(ordered[0].coords));

  for (let i = 1; i < ordered.length; i++) {
    params.append('daddr', formatCoords(ordered[i].coords));
  }

  return `https://maps.apple.com/?${params.toString()}`;
}

export function deriveLegacyFieldsFromStops(stops: LoadStop[]): {
  origin: string;
  destination: string;
  originCoords: Coords;
  destCoords: Coords;
} {
  return getLoadSummaryLabels({ stops, origin: '', destination: '', originCoords: { latitude: 0, longitude: 0 }, destCoords: { latitude: 0, longitude: 0 } });
}
