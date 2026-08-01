import { HttpsError } from 'firebase-functions/v2/https';
import {
  assertMapboxHttpOk,
  mapMapboxFeatures,
} from '../geocode';

describe('mapMapboxFeatures', () => {
  it('maps Mapbox features to GeocodeResult', () => {
    const results = mapMapboxFeatures([
      {
        id: 'address.123',
        place_name: '233 S Wacker Dr, Chicago, Illinois 60606, United States',
        center: [-87.6359, 41.8789],
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      address: '233 S Wacker Dr, Chicago, Illinois 60606, United States',
      coords: { latitude: 41.8789, longitude: -87.6359 },
      placeId: 'address.123',
    });
  });

  it('falls back to geometry.coordinates when center is missing', () => {
    const results = mapMapboxFeatures([
      {
        id: 'place.1',
        place_name: 'Dallas, Texas, United States',
        geometry: { coordinates: [-96.797, 32.7767] },
      },
    ]);

    expect(results[0].coords).toEqual({ latitude: 32.7767, longitude: -96.797 });
  });

  it('skips features without coordinates or address', () => {
    expect(
      mapMapboxFeatures([
        { id: 'bad.1', place_name: 'Nowhere' },
        { id: 'bad.2', center: [-87, 41] },
      ])
    ).toEqual([]);
  });
});

describe('assertMapboxHttpOk', () => {
  it('allows 2xx', () => {
    expect(() => assertMapboxHttpOk(200)).not.toThrow();
    expect(() => assertMapboxHttpOk(204)).not.toThrow();
  });

  it('throws failed-precondition on 401/403', () => {
    expect(() => assertMapboxHttpOk(401, 'Unauthorized')).toThrow(HttpsError);
    try {
      assertMapboxHttpOk(403, 'Forbidden');
    } catch (error) {
      expect((error as HttpsError).code).toBe('failed-precondition');
    }
  });

  it('throws resource-exhausted on 429', () => {
    try {
      assertMapboxHttpOk(429);
    } catch (error) {
      expect((error as HttpsError).code).toBe('resource-exhausted');
    }
  });
});
