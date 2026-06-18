import {
  hasAdverseConditions,
  normalizeAlerts,
  normalizePeriods,
  buildLocationWeather,
} from '../normalize';

describe('normalizePeriods', () => {
  it('maps NWS period fields', () => {
    const periods = normalizePeriods([
      {
        name: 'Tonight',
        startTime: '2026-06-18T00:00:00-05:00',
        temperature: 72,
        temperatureUnit: 'F',
        windSpeed: '10 mph',
        shortForecast: 'Partly Cloudy',
        isDaytime: false,
      },
    ]);

    expect(periods).toHaveLength(1);
    expect(periods[0].name).toBe('Tonight');
    expect(periods[0].temperature).toBe(72);
    expect(periods[0].shortForecast).toBe('Partly Cloudy');
  });
});

describe('normalizeAlerts', () => {
  it('maps NWS alert features', () => {
    const alerts = normalizeAlerts([
      {
        id: 'alert-1',
        properties: {
          id: 'alert-1',
          event: 'Tornado Warning',
          severity: 'Extreme',
          headline: 'Tornado Warning for Cook County',
          description: 'Take shelter immediately.',
          expires: '2026-06-18T12:00:00Z',
        },
      },
    ]);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].event).toBe('Tornado Warning');
    expect(alerts[0].severity).toBe('Extreme');
  });

  it('filters invalid alert entries', () => {
    expect(normalizeAlerts([{ properties: {} }, {}])).toHaveLength(0);
  });
});

describe('hasAdverseConditions', () => {
  const clearPeriods = [{ name: 'Today', startTime: '', temperature: 70, temperatureUnit: 'F', windSpeed: '5 mph', shortForecast: 'Sunny', isDaytime: true }];

  it('returns true for severe alerts', () => {
    expect(
      hasAdverseConditions(
        [{ id: '1', event: 'Flood', severity: 'Severe', headline: 'Flood', description: '', expires: '' }],
        clearPeriods
      )
    ).toBe(true);
  });

  it('returns true for adverse forecast keywords', () => {
    expect(
      hasAdverseConditions([], [
        { ...clearPeriods[0], shortForecast: 'Heavy rain and thunderstorms likely' },
      ])
    ).toBe(true);
  });

  it('returns false for clear conditions', () => {
    expect(hasAdverseConditions([], clearPeriods)).toBe(false);
  });
});

describe('buildLocationWeather', () => {
  it('sets hasAdverseConditions from alerts and periods', () => {
    const weather = buildLocationWeather(
      'Chicago',
      [{ name: 'Today', startTime: '', temperature: 70, temperatureUnit: 'F', windSpeed: '', shortForecast: 'Clear', isDaytime: true }],
      []
    );

    expect(weather.label).toBe('Chicago');
    expect(weather.available).toBe(true);
    expect(weather.hasAdverseConditions).toBe(false);
  });
});
