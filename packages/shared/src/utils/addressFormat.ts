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
const STREET_TYPE =
  String.raw`st|street|ave|avenue|blvd|boulevard|rd|road|way|dr|drive|hwy|highway|ln|lane|ct|court|cir|circle|pkwy|parkway|pl|place|trl|trail|ter|terrace|gate`;

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

function formatStreetCityStateZip(
  street: string,
  city: string,
  state: string,
  zip?: string
): string {
  const st = street.trim().replace(/\s+/g, ' ');
  const c = titleCaseCity(city);
  const s = state.toUpperCase();
  const z = (zip || '').trim();
  if (!st || !c || !US_STATE_CODES.has(s)) {
    return [st, c, z ? `${s} ${z}` : s].filter(Boolean).join(', ');
  }
  return z ? `${st}, ${c}, ${s} ${z}` : `${st}, ${c}, ${s}`;
}

/**
 * Keep street + city/state/ZIP only — drop shed/facility/warehouse nicknames.
 * Examples:
 *   "GO FAST, 153 WINYAH RD, CONWAY, SC 29526" → "153 WINYAH RD, CONWAY, SC 29526"
 *   "Shed:DALLAS DROP Address: 10420 PLANO RD DALLAS, TX 75238" → "10420 PLANO RD, DALLAS, TX 75238"
 */
export function normalizeStopAddress(address: string): string {
  let raw = (address || '').trim();
  if (!raw) return '';

  // Integrity Express: "Shed:NAME Address: STREET CITY, ST ZIP"
  const afterAddressLabel = raw.match(/\bAddress:\s*(.+)$/i);
  if (afterAddressLabel) {
    raw = afterAddressLabel[1].trim();
  }
  raw = raw
    .replace(/^Shed:\s*[^\n]*?(?=\bAddress:|\b\d{1,6}\s)/i, '')
    .replace(/^Shed:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Prefer street inside parentheses when facility wraps it: "(5500 Sheila St)"
  const parenStreet = raw.match(
    new RegExp(String.raw`\((\d[^)]*?\b(?:${STREET_TYPE})\.?)\)`, 'i')
  );
  const cityStateTail = raw.match(
    /([A-Za-z .'-]+)\s*,\s*([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?\s*(?:,?\s*(?:USA|United States))?$/i
  );
  if (parenStreet && cityStateTail) {
    const state = cityStateTail[2].toUpperCase();
    if (US_STATE_CODES.has(state)) {
      return formatStreetCityStateZip(
        parenStreet[1],
        cityStateTail[1],
        state,
        cityStateTail[3]
      );
    }
  }

  // Slice from the first street-number token (drops leading facility names).
  const streetStart = raw.search(/\b\d{1,6}\s+[A-Za-z0-9]/);
  if (streetStart < 0) return raw;
  let rest = raw.slice(streetStart).trim();
  // Drop trailing junk after ZIP (notes, phone, etc.)
  rest = rest.replace(/\s+(?:Phone|Date|Time|Appt|Remarks|Pallets|Pieces)\b.*$/i, '').trim();

  const withComma = rest.match(
    new RegExp(
      String.raw`^(\d[^,]*?\b(?:${STREET_TYPE})\.?)\s*,\s*([^,]+)\s*,\s*([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?\s*$`,
      'i'
    )
  );
  if (withComma && US_STATE_CODES.has(withComma[3].toUpperCase())) {
    return formatStreetCityStateZip(withComma[1], withComma[2], withComma[3], withComma[4]);
  }

  const noCommaAfterStreet = rest.match(
    new RegExp(
      String.raw`^(\d.+?\b(?:${STREET_TYPE})\.?)\s+([A-Za-z .'-]+)\s*,\s*([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?\s*$`,
      'i'
    )
  );
  if (noCommaAfterStreet && US_STATE_CODES.has(noCommaAfterStreet[3].toUpperCase())) {
    return formatStreetCityStateZip(
      noCommaAfterStreet[1],
      noCommaAfterStreet[2],
      noCommaAfterStreet[3],
      noCommaAfterStreet[4]
    );
  }

  // "10420 PLANO RD DALLAS, TX 75238" — city may be ALL CAPS glued after street type
  const glued = rest.match(
    new RegExp(
      String.raw`^(\d.+?\b(?:${STREET_TYPE})\.?)\s+([A-Z][A-Za-z .'-]+)\s*,\s*([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?\s*$`,
      'i'
    )
  );
  if (glued && US_STATE_CODES.has(glued[3].toUpperCase())) {
    return formatStreetCityStateZip(glued[1], glued[2], glued[3], glued[4]);
  }

  return rest;
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
