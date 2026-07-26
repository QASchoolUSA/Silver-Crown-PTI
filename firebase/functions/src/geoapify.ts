import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

const geoapifyApiKey = defineSecret('GEOAPIFY_API_KEY');
const METERS_PER_MILE = 1609.344;

interface RouteStopInput {
  type: 'pickup' | 'dropoff';
  address: string;
  sequence: number;
  coords?: { latitude: number; longitude: number };
}

interface GeoapifyFeature {
  properties?: {
    formatted?: string;
    lat?: number;
    lon?: number;
    distance?: number;
    distance_units?: string;
  };
  geometry?: { coordinates?: [number, number] };
}

export const calculateRouteMiles = onCall(
  { secrets: [geoapifyApiKey], timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to calculate route miles.');
    }
    const userSnap = await admin.firestore().collection('users').doc(request.auth.uid).get();
    if (!userSnap.exists || userSnap.data()?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin access is required.');
    }

    const { stops, mode = 'truck' } = request.data as {
      stops?: RouteStopInput[];
      mode?: 'light_truck' | 'medium_truck' | 'truck' | 'heavy_truck';
    };

    if (!Array.isArray(stops) || stops.length < 2 || stops.length > 25) {
      throw new HttpsError('invalid-argument', 'Provide between 2 and 25 ordered stops.');
    }

    const key = process.env.GEOAPIFY_API_KEY || geoapifyApiKey.value();
    if (!key) {
      throw new HttpsError('failed-precondition', 'Geoapify is not configured.');
    }

    const geocoded = [];
    for (const stop of stops) {
      if (!stop.address?.trim()) {
        throw new HttpsError('invalid-argument', 'Every stop needs an address.');
      }

      const coords = isValidCoords(stop.coords)
        ? stop.coords
        : await geocodeAddress(stop.address, key);
      geocoded.push({ ...stop, coords });
    }

    const waypointValue = geocoded
      .map((stop) => `${stop.coords.latitude},${stop.coords.longitude}`)
      .join('|');
    const routeUrl = new URL('https://api.geoapify.com/v1/routing');
    routeUrl.search = new URLSearchParams({
      waypoints: waypointValue,
      mode,
      units: 'imperial',
      type: 'balanced',
      format: 'geojson',
      apiKey: key,
    }).toString();

    const routeResponse = await fetch(routeUrl);
    if (!routeResponse.ok) {
      throw new HttpsError('unavailable', `Geoapify routing failed (${routeResponse.status}).`);
    }

    const routeJson = await routeResponse.json() as { features?: GeoapifyFeature[] };
    const properties = routeJson.features?.[0]?.properties;
    if (!properties || !Number.isFinite(properties.distance)) {
      throw new HttpsError('not-found', 'No truck route was found for these stops.');
    }

    const units = properties.distance_units?.toLowerCase() || '';
    const miles = units.includes('mile')
      ? properties.distance!
      : properties.distance! / METERS_PER_MILE;

    return {
      miles: Math.round(miles),
      milesExact: Number(miles.toFixed(1)),
      distanceUnits: 'miles',
      stops: geocoded,
    };
  }
);

async function geocodeAddress(
  address: string,
  apiKey: string
): Promise<{ latitude: number; longitude: number }> {
  const url = new URL('https://api.geoapify.com/v1/geocode/search');
  url.search = new URLSearchParams({
    text: address,
    format: 'geojson',
    filter: 'countrycode:us',
    bias: 'countrycode:us',
    limit: '1',
    apiKey,
  }).toString();

  const response = await fetch(url);
  if (!response.ok) {
    throw new HttpsError('unavailable', `Geoapify geocoding failed (${response.status}).`);
  }

  const json = await response.json() as { features?: GeoapifyFeature[] };
  const feature = json.features?.[0];
  const lon = feature?.properties?.lon ?? feature?.geometry?.coordinates?.[0];
  const lat = feature?.properties?.lat ?? feature?.geometry?.coordinates?.[1];
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new HttpsError('not-found', `Could not geocode: ${address}`);
  }

  return { latitude: lat!, longitude: lon! };
}

function isValidCoords(
  coords: RouteStopInput['coords']
): coords is { latitude: number; longitude: number } {
  return Boolean(
    coords
      && Number.isFinite(coords.latitude)
      && Number.isFinite(coords.longitude)
      && Math.abs(coords.latitude) <= 90
      && Math.abs(coords.longitude) <= 180
      && (coords.latitude !== 0 || coords.longitude !== 0)
  );
}
