import {
  buildAppleMapsDirectionsUrl,
  buildGoogleMapsDirectionsUrl,
  getOrderedStops,
  getRoutePolyline,
  normalizeLoadFromFirestore,
} from '../utils/loadStops';
import type { LoadStop } from '../types';

const pickup1: LoadStop = {
  type: 'pickup',
  address: '100 N Michigan Ave, Chicago, IL',
  coords: { latitude: 41.8827, longitude: -87.6233 },
  sequence: 0,
};

const pickup2: LoadStop = {
  type: 'pickup',
  address: '200 W Adams St, Chicago, IL',
  coords: { latitude: 41.8796, longitude: -87.6339 },
  sequence: 1,
};

const dropoff1: LoadStop = {
  type: 'dropoff',
  address: '500 Main St, Dallas, TX',
  coords: { latitude: 32.7801, longitude: -96.8005 },
  sequence: 0,
};

describe('loadStops', () => {
  it('orders pickups before dropoffs by sequence', () => {
    const ordered = getOrderedStops({ stops: [dropoff1, pickup2, pickup1] });
    expect(ordered.map((s) => s.address)).toEqual([
      pickup1.address,
      pickup2.address,
      dropoff1.address,
    ]);
  });

  it('builds route polyline from stops', () => {
    const polyline = getRoutePolyline({ stops: [pickup1, dropoff1], originCoords: pickup1.coords, destCoords: dropoff1.coords });
    expect(polyline).toHaveLength(2);
    expect(polyline[0]).toEqual(pickup1.coords);
  });

  it('normalizes legacy firestore docs without stops', () => {
    const normalized = normalizeLoadFromFirestore({
      origin: 'Chicago, IL',
      destination: 'Dallas, TX',
      originCoords: pickup1.coords,
      destCoords: dropoff1.coords,
    });
    expect(normalized.stops).toHaveLength(2);
    expect(normalized.stops[0].type).toBe('pickup');
    expect(normalized.stops[1].type).toBe('dropoff');
  });

  it('builds Google Maps URL with waypoints', () => {
    const url = buildGoogleMapsDirectionsUrl([pickup1, pickup2, dropoff1]);
    expect(url).toContain('google.com/maps/dir');
    expect(url).toContain('waypoints=');
    expect(url).toContain('travelmode=driving');
  });

  it('builds Apple Maps URL with multiple daddr params', () => {
    const url = buildAppleMapsDirectionsUrl([pickup1, dropoff1]);
    expect(url).toContain('maps.apple.com');
    expect(url).toContain('saddr=');
    expect(url).toContain('daddr=');
  });

  it('returns null for single stop', () => {
    expect(buildGoogleMapsDirectionsUrl([pickup1])).toBeNull();
    expect(buildAppleMapsDirectionsUrl([pickup1])).toBeNull();
  });
});
