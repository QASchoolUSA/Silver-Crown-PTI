import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from './config';

export interface GeocodeResult {
  address: string;
  coords: { latitude: number; longitude: number };
  placeId?: string;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const fn = httpsCallable<{ query: string }, { results: GeocodeResult[] }>(
    getFirebaseFunctions(),
    'geocodeAddress'
  );
  const { data } = await fn({ query });
  return data.results;
}
