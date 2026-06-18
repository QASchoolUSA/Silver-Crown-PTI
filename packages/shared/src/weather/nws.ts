import { httpsCallable } from 'firebase/functions';
import type { Coords, RouteWeather } from '../types';
import { getFirebaseFunctions } from '../firebase/config';
import {
  buildLocationWeather,
  emptyLocationWeather,
  normalizeAlerts,
  normalizePeriods,
} from './normalize';

const NWS_BASE = 'https://api.weather.gov';
export const NWS_USER_AGENT = '(silver-crown-app, contact@silvercrown.com)';

export { hasAdverseConditions, normalizeAlerts, normalizePeriods } from './normalize';

export type NwsFetchOptions = {
  userAgent?: string;
  fetchFn?: typeof fetch;
};

export async function fetchLocationWeather(
  label: string,
  coords: Coords,
  options?: NwsFetchOptions
): Promise<import('../types').LocationWeather> {
  const fetchFn = options?.fetchFn ?? fetch;
  const headers = {
    'User-Agent': options?.userAgent ?? NWS_USER_AGENT,
    Accept: 'application/geo+json',
  };

  try {
    const lat = coords.latitude.toFixed(4);
    const lon = coords.longitude.toFixed(4);

    const pointsRes = await fetchFn(`${NWS_BASE}/points/${lat},${lon}`, { headers });
    if (!pointsRes.ok) {
      return emptyLocationWeather(label);
    }

    const pointsData = (await pointsRes.json()) as {
      properties?: { forecast?: string };
    };
    const forecastUrl = pointsData.properties?.forecast;

    let periods: ReturnType<typeof normalizePeriods> = [];
    if (forecastUrl) {
      const forecastRes = await fetchFn(forecastUrl, { headers });
      if (forecastRes.ok) {
        const forecastData = (await forecastRes.json()) as {
          properties?: { periods?: unknown[] };
        };
        periods = normalizePeriods(forecastData.properties?.periods ?? []).slice(0, 3);
      }
    }

    let alerts: ReturnType<typeof normalizeAlerts> = [];
    const alertsRes = await fetchFn(`${NWS_BASE}/alerts/active?point=${lat},${lon}`, { headers });
    if (alertsRes.ok) {
      const alertsData = (await alertsRes.json()) as { features?: unknown[] };
      alerts = normalizeAlerts(alertsData.features ?? []);
    }

    return buildLocationWeather(label, periods, alerts);
  } catch {
    return emptyLocationWeather(label);
  }
}

export async function fetchRouteWeather(
  originLabel: string,
  originCoords: Coords,
  destLabel: string,
  destCoords: Coords,
  options?: NwsFetchOptions
): Promise<RouteWeather> {
  const [origin, destination] = await Promise.all([
    fetchLocationWeather(originLabel, originCoords, options),
    fetchLocationWeather(destLabel, destCoords, options),
  ]);
  return { origin, destination };
}

export async function getRouteWeather(
  originCoords: Coords,
  destCoords: Coords,
  originLabel = 'Origin',
  destLabel = 'Destination'
): Promise<RouteWeather> {
  const fn = httpsCallable<
    {
      originCoords: Coords;
      destCoords: Coords;
      originLabel?: string;
      destLabel?: string;
    },
    RouteWeather
  >(getFirebaseFunctions(), 'getRouteWeather');

  const result = await fn({ originCoords, destCoords, originLabel, destLabel });
  return result.data;
}
