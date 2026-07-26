import { formatCityState, getLoadCityStates } from '../utils/addressFormat';
import type { Load } from '../types';

describe('formatCityState', () => {
  it('extracts City, ST from a full street address with ZIP and country', () => {
    expect(
      formatCityState('5500 Sheila St, Commerce, CA 90040, USA')
    ).toBe('Commerce, CA');
  });

  it('title-cases ALL-CAPS rate-con cities', () => {
    expect(formatCityState('MESQUITE, NV 89027')).toBe('Mesquite, NV');
  });

  it('handles parenthetical facility names before the city', () => {
    expect(
      formatCityState(
        'Dreamway Logistics INC (5500 Sheila St) (Check in @ dock 85), Commerce, CA 90040'
      )
    ).toBe('Commerce, CA');
  });

  it('keeps a bare City, ST pair', () => {
    expect(formatCityState('Chicago, IL')).toBe('Chicago, IL');
  });

  it('preserves mixed-case city names', () => {
    expect(formatCityState('McAllen, TX 78501')).toBe('McAllen, TX');
  });

  it('falls back to the original string when no state is found', () => {
    expect(formatCityState('Unknown Facility Yard')).toBe('Unknown Facility Yard');
  });
});

describe('getLoadCityStates', () => {
  it('uses first pickup and last drop-off with extra-stop counts', () => {
    const load = {
      origin: 'Mesquite, NV',
      destination: 'Dallas, TX',
      stops: [
        {
          type: 'pickup' as const,
          address: 'Yard A, Mesquite, NV 89027',
          coords: { latitude: 36.8, longitude: -114.0 },
          sequence: 0,
        },
        {
          type: 'pickup' as const,
          address: 'Yard B, Las Vegas, NV 89101',
          coords: { latitude: 36.1, longitude: -115.1 },
          sequence: 1,
        },
        {
          type: 'dropoff' as const,
          address: 'Dock 1, Phoenix, AZ 85001',
          coords: { latitude: 33.4, longitude: -112.0 },
          sequence: 0,
        },
        {
          type: 'dropoff' as const,
          address: 'Dock 2, Commerce, CA 90040',
          coords: { latitude: 34.0, longitude: -118.1 },
          sequence: 1,
        },
      ],
    } satisfies Pick<Load, 'stops' | 'origin' | 'destination'>;

    expect(getLoadCityStates(load)).toEqual({
      pickup: 'Mesquite, NV',
      dropoff: 'Commerce, CA',
      extraPickups: 1,
      extraDropoffs: 1,
    });
  });

  it('falls back to origin/destination when stops are empty', () => {
    expect(
      getLoadCityStates({
        origin: 'Chicago, IL',
        destination: 'Dallas, TX',
        stops: [],
      })
    ).toEqual({
      pickup: 'Chicago, IL',
      dropoff: 'Dallas, TX',
      extraPickups: 0,
      extraDropoffs: 0,
    });
  });
});
