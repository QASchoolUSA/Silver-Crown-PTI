type Coords = { latitude: number; longitude: number };

type WeatherAlert = {
  id: string;
  event: string;
  severity: string;
  headline: string;
  description: string;
  expires: string;
};

type WeatherPeriod = {
  name: string;
  startTime: string;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  shortForecast: string;
  isDaytime: boolean;
};

type LocationWeather = {
  label: string;
  periods: WeatherPeriod[];
  alerts: WeatherAlert[];
  hasAdverseConditions: boolean;
  available: boolean;
};

export type RouteWeather = {
  origin: LocationWeather;
  destination: LocationWeather;
};

const NWS_BASE = 'https://api.weather.gov';
const NWS_USER_AGENT = '(silver-crown-app, contact@silvercrown.com)';
const CACHE_TTL_MS = 15 * 60 * 1000;

const ADVERSE_KEYWORDS = [
  'thunderstorm', 'tornado', 'blizzard', ' ice ', 'snow', 'flood', 'hail',
  'heavy rain', 'freezing', 'wind advisory', 'hurricane', ' tropical ',
  'winter storm', 'dense fog',
];
const ADVERSE_SEVERITIES = ['Extreme', 'Severe', 'Moderate'];

const weatherCache = new Map<string, { data: LocationWeather; expires: number }>();

function hasAdverseConditions(alerts: WeatherAlert[], periods: WeatherPeriod[]): boolean {
  if (alerts.some((a) => ADVERSE_SEVERITIES.includes(a.severity))) return true;
  const text = periods.map((p) => p.shortForecast.toLowerCase()).join(' ');
  return ADVERSE_KEYWORDS.some((kw) => text.includes(kw));
}

function normalizeAlerts(features: unknown[]): WeatherAlert[] {
  return features
    .map((feature) => {
      const f = feature as { id?: string; properties?: Record<string, string> };
      const props = f.properties;
      if (!props) return null;
      return {
        id: props.id ?? f.id ?? '',
        event: props.event ?? 'Alert',
        severity: props.severity ?? 'Unknown',
        headline: props.headline ?? props.event ?? 'Weather Alert',
        description: props.description ?? '',
        expires: props.expires ?? '',
      };
    })
    .filter((a): a is WeatherAlert => a !== null && a.id !== '');
}

function normalizePeriods(rawPeriods: unknown[]): WeatherPeriod[] {
  return rawPeriods.map((raw) => {
    const p = raw as Record<string, unknown>;
    return {
      name: (p.name as string) ?? '',
      startTime: (p.startTime as string) ?? '',
      temperature: (p.temperature as number) ?? 0,
      temperatureUnit: (p.temperatureUnit as string) ?? 'F',
      windSpeed: (p.windSpeed as string) ?? '',
      shortForecast: (p.shortForecast as string) ?? '',
      isDaytime: (p.isDaytime as boolean) ?? true,
    };
  });
}

function emptyLocationWeather(label: string): LocationWeather {
  return { label, periods: [], alerts: [], hasAdverseConditions: false, available: false };
}

function buildLocationWeather(label: string, periods: WeatherPeriod[], alerts: WeatherAlert[]): LocationWeather {
  return { label, periods, alerts, hasAdverseConditions: hasAdverseConditions(alerts, periods), available: true };
}

function cacheKey(coords: Coords): string {
  return `${coords.latitude.toFixed(2)},${coords.longitude.toFixed(2)}`;
}

export function isValidCoords(coords: Coords): boolean {
  return (
    typeof coords.latitude === 'number' &&
    typeof coords.longitude === 'number' &&
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  );
}

async function fetchLocationWeather(label: string, coords: Coords): Promise<LocationWeather> {
  const key = cacheKey(coords);
  const cached = weatherCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return { ...cached.data, label };
  }

  const headers = { 'User-Agent': NWS_USER_AGENT, Accept: 'application/geo+json' };

  try {
    const lat = coords.latitude.toFixed(4);
    const lon = coords.longitude.toFixed(4);

    const pointsRes = await fetch(`${NWS_BASE}/points/${lat},${lon}`, { headers });
    if (!pointsRes.ok) return emptyLocationWeather(label);

    const pointsData = (await pointsRes.json()) as { properties?: { forecast?: string } };
    const forecastUrl = pointsData.properties?.forecast;

    let periods: WeatherPeriod[] = [];
    if (forecastUrl) {
      const forecastRes = await fetch(forecastUrl, { headers });
      if (forecastRes.ok) {
        const forecastData = (await forecastRes.json()) as { properties?: { periods?: unknown[] } };
        periods = normalizePeriods(forecastData.properties?.periods ?? []).slice(0, 3);
      }
    }

    let alerts: WeatherAlert[] = [];
    const alertsRes = await fetch(`${NWS_BASE}/alerts/active?point=${lat},${lon}`, { headers });
    if (alertsRes.ok) {
      const alertsData = (await alertsRes.json()) as { features?: unknown[] };
      alerts = normalizeAlerts(alertsData.features ?? []);
    }

    const result = buildLocationWeather(label, periods, alerts);
    weatherCache.set(key, { data: result, expires: Date.now() + CACHE_TTL_MS });
    return result;
  } catch {
    return emptyLocationWeather(label);
  }
}

export async function fetchRouteWeatherForFunction(
  originLabel: string,
  originCoords: Coords,
  destLabel: string,
  destCoords: Coords
): Promise<RouteWeather> {
  const [origin, destination] = await Promise.all([
    fetchLocationWeather(originLabel, originCoords),
    fetchLocationWeather(destLabel, destCoords),
  ]);
  return { origin, destination };
}
