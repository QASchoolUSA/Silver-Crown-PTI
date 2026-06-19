import { formatPhotonAddress, mapPhotonFeatures } from '../geocode';

describe('formatPhotonAddress', () => {
  it('formats street address with city and state', () => {
    expect(
      formatPhotonAddress({
        housenumber: '233',
        street: 'South Wacker Drive',
        city: 'Chicago',
        state: 'Illinois',
        postcode: '60606',
        country: 'United States',
      })
    ).toBe('233 South Wacker Drive, Chicago, Illinois, 60606, United States');
  });

  it('falls back to name when street is missing', () => {
    expect(
      formatPhotonAddress({
        name: 'Berlin',
        country: 'Germany',
      })
    ).toBe('Berlin, Germany');
  });
});

describe('mapPhotonFeatures', () => {
  it('maps GeoJSON features to GeocodeResult', () => {
    const results = mapPhotonFeatures([
      {
        geometry: { coordinates: [-87.6359, 41.8789] },
        properties: {
          osm_id: 123,
          osm_type: 'W',
          housenumber: '233',
          street: 'South Wacker Drive',
          city: 'Chicago',
          state: 'Illinois',
          country: 'United States',
        },
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].coords).toEqual({ latitude: 41.8789, longitude: -87.6359 });
    expect(results[0].placeId).toBe('W:123');
    expect(results[0].address).toContain('233 South Wacker Drive');
  });
});
