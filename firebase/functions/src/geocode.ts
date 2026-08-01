import { HttpsError } from 'firebase-functions/v2/https';

const MAPBOX_GEOCODE_BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const THROTTLE_MS = 300;
const CACHE_MAX = 50;
const MAX_RESULTS = 5;

/** Continental US bbox: minLon,minLat,maxLon,maxLat */
const US_BBOX = '-125.0,24.0,-66.0,49.5';

let lastRequestAt = 0;
const cache = new Map<string, GeocodeResult[]>();

export interface GeocodeResult {
  address: string;
  coords: { latitude: number; longitude: number };
  placeId?: string;
}

export interface MapboxFeature {
  id?: string;
  place_name?: string;
  text?: string;
  center?: [number, number];
  geometry?: { coordinates?: [number, number] };
}

export function mapMapboxFeatures(features: MapboxFeature[]): GeocodeResult[] {
  const results: GeocodeResult[] = [];
  for (const feature of features) {
    const coordsPair = feature.center ?? feature.geometry?.coordinates;
    if (!coordsPair || coordsPair.length < 2) continue;
    const [lon, lat] = coordsPair;
    const address = (feature.place_name || feature.text || '').trim();
    if (!address || Number.isNaN(lat) || Number.isNaN(lon)) continue;
    results.push({
      address,
      coords: { latitude: lat, longitude: lon },
      placeId: feature.id,
    });
  }
  return results;
}

export function assertMapboxHttpOk(status: number, bodyMessage?: string): void {
  if (status >= 200 && status < 300) return;
  if (status === 401 || status === 403) {
    throw new HttpsError(
      'failed-precondition',
      bodyMessage ||
        'Mapbox request denied. Check MAPBOX_ACCESS_TOKEN and token scopes (geocoding).'
    );
  }
  if (status === 429) {
    throw new HttpsError('resource-exhausted', 'Mapbox geocoding quota exceeded.');
  }
  if (status === 422) {
    throw new HttpsError('invalid-argument', bodyMessage || 'Invalid Mapbox geocoding request.');
  }
  throw new HttpsError(
    'internal',
    bodyMessage || `Mapbox geocoding failed (${status})`
  );
}

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < THROTTLE_MS) {
    await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

function cacheGet(key: string): GeocodeResult[] | undefined {
  const normalized = key.trim().toLowerCase();
  const hit = cache.get(normalized);
  if (hit) {
    cache.delete(normalized);
    cache.set(normalized, hit);
  }
  return hit;
}

function cacheSet(key: string, results: GeocodeResult[]): void {
  const normalized = key.trim().toLowerCase();
  if (cache.has(normalized)) cache.delete(normalized);
  cache.set(normalized, results);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

export async function searchMapbox(
  query: string,
  accessToken: string
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  if (!accessToken) {
    throw new HttpsError('failed-precondition', 'Mapbox is not configured.');
  }

  await throttle();

  const encoded = encodeURIComponent(trimmed);
  const params = new URLSearchParams({
    access_token: accessToken,
    autocomplete: 'true',
    limit: String(MAX_RESULTS),
    country: 'us',
    types: 'address,place,locality,neighborhood,poi',
    bbox: US_BBOX,
    language: 'en',
  });

  const response = await fetch(`${MAPBOX_GEOCODE_BASE}/${encoded}.json?${params.toString()}`);
  const data = (await response.json()) as { features?: MapboxFeature[]; message?: string };

  assertMapboxHttpOk(response.status, data.message);

  return mapMapboxFeatures(data.features ?? []);
}

export async function geocodeSearch(
  query: string,
  accessToken: string
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const cached = cacheGet(trimmed);
  if (cached) return cached;

  const results = await searchMapbox(trimmed, accessToken);
  cacheSet(trimmed, results);
  return results;
}

/** Test helper — clears the in-memory cache between cases */
export function clearGeocodeCache(): void {
  cache.clear();
}
