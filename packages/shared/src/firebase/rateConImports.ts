import { httpsCallable } from 'firebase/functions';
import type { LoadStatus, RateConDraft, RateConStop } from '../types';
import {
  hasUsableCoords,
  hasUsableMiles,
  rateConDraftToCreateLoadInput,
  validateRateConDraft,
} from '../utils/rateConDrafts';
import { getFirebaseFunctions } from './config';
import { linkDocumentToLoad } from './documents';
import { geocodeAddress } from './geocode';
import { createLoad, getCompanyLoads } from './loads';

export interface RouteMilesResult {
  miles: number;
  milesExact: number;
  distanceUnits: 'miles';
  mode?: string;
  stops: Array<RateConStop & { coords: { latitude: number; longitude: number } }>;
}

export async function calculateRateConRouteMiles(
  stops: RateConStop[]
): Promise<RouteMilesResult> {
  const callable = httpsCallable<
    { stops: RateConStop[]; mode: 'heavy_truck' },
    RouteMilesResult
  >(getFirebaseFunctions(), 'calculateRouteMiles');
  const result = await callable({ stops, mode: 'heavy_truck' });
  return result.data;
}

/** Silent Mapbox geocode — first hit. Keeps PDF/user address text unless very short. */
async function geocodeStop(stop: RateConStop): Promise<RateConStop> {
  if (hasUsableCoords(stop)) return stop;

  const results = await geocodeAddress(stop.address.trim());
  const hit = results[0];
  if (!hit) {
    throw new Error(`Could not geocode stop: ${stop.address.trim()}`);
  }

  const keepOriginal = stop.address.trim().length >= 12;
  return {
    ...stop,
    address: keepOriginal ? stop.address.trim() : hit.address,
    coords: hit.coords,
  };
}

/**
 * Resolve text addresses to coords (and miles when missing) before createLoad.
 * No autocomplete UI — Mapbox first-result only.
 */
export async function resolveRateConDraftForCreate(
  draft: RateConDraft
): Promise<RateConDraft> {
  const validation = validateRateConDraft(draft);
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  const stops: RateConStop[] = [];

  for (const stop of draft.stops) {
    stops.push(await geocodeStop(stop));
  }

  let resolved: RateConDraft = { ...draft, stops };

  if (!hasUsableMiles(resolved)) {
    const route = await calculateRateConRouteMiles(resolved.stops);
    resolved = {
      ...resolved,
      miles: String(route.miles),
      milesSource: 'geoapify',
      stops: route.stops,
      warnings: [
        ...(resolved.warnings || []),
        'Miles calculated with Geoapify heavy_truck (loaded semi) routing.',
      ],
    };
  }

  if (resolved.stops.some((stop) => !hasUsableCoords(stop))) {
    throw new Error('Every stop must be geocoded before creating the load.');
  }

  return resolved;
}

export interface CreateLoadsFromDraftsResult {
  created: Array<{ draft: RateConDraft; loadId: string }>;
  skipped: Array<{ draft: RateConDraft; reason: string }>;
}

export async function createLoadsFromDrafts(
  companyId: string,
  drafts: RateConDraft[],
  options: { status?: LoadStatus } = {}
): Promise<CreateLoadsFromDraftsResult> {
  const existingLoads = await getCompanyLoads(companyId);
  const existingRefs = new Set(
    existingLoads.map((load) => load.loadRef?.trim().toLowerCase()).filter(Boolean)
  );
  const created: CreateLoadsFromDraftsResult['created'] = [];
  const skipped: CreateLoadsFromDraftsResult['skipped'] = [];

  for (const draft of drafts) {
    const validation = validateRateConDraft(draft);
    if (!validation.valid) {
      skipped.push({ draft, reason: validation.errors.join(' ') });
      continue;
    }

    const normalizedRef = draft.loadRef?.trim().toLowerCase();
    if (normalizedRef && existingRefs.has(normalizedRef)) {
      skipped.push({ draft, reason: `Load ${draft.loadRef} already exists.` });
      continue;
    }

    try {
      const resolved = await resolveRateConDraftForCreate(draft);
      const input = rateConDraftToCreateLoadInput(companyId, resolved, {
        status: options.status || 'available',
      });
      const loadId = await createLoad(input);
      if (resolved.documentId) await linkDocumentToLoad(resolved.documentId, loadId);
      if (normalizedRef) existingRefs.add(normalizedRef);
      created.push({ draft: resolved, loadId });
    } catch (error) {
      skipped.push({
        draft,
        reason: error instanceof Error ? error.message : 'Load creation failed.',
      });
    }
  }

  return { created, skipped };
}
