import type { Load } from '../types';
import { sortStopsByType } from './loadStops';

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
]);

const COUNTRY_SUFFIX = /^(usa|u\.s\.a\.|united states|united states of america)$/i;
const STATE_TOKEN = /^([A-Za-z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/;

function titleCaseCity(city: string): string {
  const trimmed = city.trim().replace(/\s+/g, ' ');
  if (!trimmed) return trimmed;
  // Preserve mixed/title case; only rewrite ALL-CAPS or all-lowercase.
  if (trimmed !== trimmed.toUpperCase() && trimmed !== trimmed.toLowerCase()) {
    return trimmed;
  }
  return trimmed
    .toLowerCase()
    .split(' ')
    .map((word) => {
      if (!word) return word;
      // Keep short connectors lowercase when mid-name (e.g. "Mc" handled simply).
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Extract a compact `City, ST` label from a full printed address.
 * Falls back to the trimmed original string when no US state code is found.
 */
export function formatCityState(address: string): string {
  const trimmed = (address || '').trim();
  if (!trimmed) return '';

  const parts = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return trimmed;

  // Drop trailing country so `City, ST ZIP, USA` still resolves.
  while (parts.length > 0 && COUNTRY_SUFFIX.test(parts[parts.length - 1])) {
    parts.pop();
  }

  for (let i = parts.length - 1; i >= 1; i--) {
    const stateMatch = parts[i].match(STATE_TOKEN);
    if (!stateMatch) continue;
    const state = stateMatch[1].toUpperCase();
    if (!US_STATE_CODES.has(state)) continue;

    const city = titleCaseCity(parts[i - 1]);
    if (!city) continue;
    return `${city}, ${state}`;
  }

  // Bare "City ST" / "City ST 89034" without a comma.
  const bare = trimmed.match(
    /^(.+?)\s+([A-Za-z]{2})(?:\s+\d{5}(?:-\d{4})?)?(?:\s*,?\s*(?:USA|United States))?$/i
  );
  if (bare) {
    const state = bare[2].toUpperCase();
    if (US_STATE_CODES.has(state)) {
      return `${titleCaseCity(bare[1])}, ${state}`;
    }
  }

  return trimmed;
}

export interface LoadCityStates {
  pickup: string;
  dropoff: string;
  extraPickups: number;
  extraDropoffs: number;
}

/**
 * City/state labels for list/grid views: first pickup and last drop-off.
 */
export function getLoadCityStates(
  load: Pick<Load, 'stops' | 'origin' | 'destination'>
): LoadCityStates {
  const pickups = sortStopsByType(load.stops ?? [], 'pickup');
  const dropoffs = sortStopsByType(load.stops ?? [], 'dropoff');

  const pickupAddress = pickups[0]?.address || load.origin || '';
  const dropoffAddress =
    dropoffs.length > 0
      ? dropoffs[dropoffs.length - 1].address
      : load.destination || '';

  return {
    pickup: formatCityState(pickupAddress),
    dropoff: formatCityState(dropoffAddress),
    extraPickups: Math.max(0, pickups.length - 1),
    extraDropoffs: Math.max(0, dropoffs.length - 1),
  };
}
