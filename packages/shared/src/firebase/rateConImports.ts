import { httpsCallable } from 'firebase/functions';
import type { LoadStatus, RateConDraft, RateConStop } from '../types';
import { rateConDraftToCreateLoadInput, validateRateConDraft } from '../utils/rateConDrafts';
import { getFirebaseFunctions } from './config';
import { linkDocumentToLoad } from './documents';
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
      const input = rateConDraftToCreateLoadInput(companyId, draft, {
        status: options.status || 'available',
      });
      const loadId = await createLoad(input);
      if (draft.documentId) await linkDocumentToLoad(draft.documentId, loadId);
      if (normalizedRef) existingRefs.add(normalizedRef);
      created.push({ draft, loadId });
    } catch (error) {
      skipped.push({
        draft,
        reason: error instanceof Error ? error.message : 'Load creation failed.',
      });
    }
  }

  return { created, skipped };
}
