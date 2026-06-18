import type { WeatherAlert, WeatherPeriod } from '../types';

const ADVERSE_KEYWORDS = [
  'thunderstorm',
  'tornado',
  'blizzard',
  ' ice ',
  'snow',
  'flood',
  'hail',
  'heavy rain',
  'freezing',
  'wind advisory',
  'hurricane',
  ' tropical ',
  'winter storm',
  'dense fog',
];

const ADVERSE_SEVERITIES = ['Extreme', 'Severe', 'Moderate'];

export function hasAdverseConditions(alerts: WeatherAlert[], periods: WeatherPeriod[]): boolean {
  if (alerts.some((a) => ADVERSE_SEVERITIES.includes(a.severity))) {
    return true;
  }
  const text = periods.map((p) => p.shortForecast.toLowerCase()).join(' ');
  return ADVERSE_KEYWORDS.some((kw) => text.includes(kw));
}

export function normalizeAlerts(features: unknown[]): WeatherAlert[] {
  return features
    .map((feature) => {
      const f = feature as {
        id?: string;
        properties?: {
          id?: string;
          event?: string;
          severity?: string;
          headline?: string;
          description?: string;
          expires?: string;
        };
      };
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

export function normalizePeriods(rawPeriods: unknown[]): WeatherPeriod[] {
  return rawPeriods.map((raw) => {
    const p = raw as {
      name?: string;
      startTime?: string;
      temperature?: number;
      temperatureUnit?: string;
      windSpeed?: string;
      shortForecast?: string;
      isDaytime?: boolean;
    };
    return {
      name: p.name ?? '',
      startTime: p.startTime ?? '',
      temperature: p.temperature ?? 0,
      temperatureUnit: p.temperatureUnit ?? 'F',
      windSpeed: p.windSpeed ?? '',
      shortForecast: p.shortForecast ?? '',
      isDaytime: p.isDaytime ?? true,
    };
  });
}

export function emptyLocationWeather(label: string): import('../types').LocationWeather {
  return {
    label,
    periods: [],
    alerts: [],
    hasAdverseConditions: false,
    available: false,
  };
}

export function buildLocationWeather(
  label: string,
  periods: WeatherPeriod[],
  alerts: WeatherAlert[]
): import('../types').LocationWeather {
  return {
    label,
    periods,
    alerts,
    hasAdverseConditions: hasAdverseConditions(alerts, periods),
    available: true,
  };
}
