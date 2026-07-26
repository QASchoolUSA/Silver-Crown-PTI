import type { CreateLoadInput } from '../firebase/loads';
import type { EquipmentType, LoadStop, RateConDraft, RateConStop } from '../types';

export interface RateConDraftValidation {
  valid: boolean;
  errors: string[];
}

function hasUsableCoords(stop: RateConStop): stop is RateConStop & { coords: NonNullable<RateConStop['coords']> } {
  return Boolean(
    stop.coords
      && Number.isFinite(stop.coords.latitude)
      && Number.isFinite(stop.coords.longitude)
      && (stop.coords.latitude !== 0 || stop.coords.longitude !== 0)
  );
}

export function validateRateConDraft(draft: RateConDraft): RateConDraftValidation {
  const errors: string[] = [];
  const pickups = draft.stops.filter((stop) => stop.type === 'pickup');
  const dropoffs = draft.stops.filter((stop) => stop.type === 'dropoff');
  const payout = Number.parseFloat((draft.payout || '').replace(/[$,]/g, ''));

  if (pickups.length === 0) errors.push('At least one pickup is required.');
  if (dropoffs.length === 0) errors.push('At least one dropoff is required.');
  if (draft.stops.some((stop) => !stop.address.trim())) errors.push('Every stop needs an address.');
  if (draft.stops.some((stop) => !hasUsableCoords(stop))) errors.push('Every stop must be geocoded.');
  if (!Number.isFinite(payout) || payout <= 0) {
    errors.push('Gross pay must be greater than zero.');
  }

  return { valid: errors.length === 0, errors };
}

export function rateConDraftToCreateLoadInput(
  companyId: string,
  draft: RateConDraft,
  options: { status?: CreateLoadInput['status']; defaultEquipment?: EquipmentType } = {}
): CreateLoadInput {
  const validation = validateRateConDraft(draft);
  if (!validation.valid) throw new Error(validation.errors.join(' '));

  const stops: LoadStop[] = draft.stops.map((stop) => ({
    type: stop.type,
    address: stop.address.trim(),
    coords: stop.coords!,
    sequence: stop.sequence,
  }));

  return {
    companyId,
    assignedDriverId: null,
    stops,
    payout: draft.payout!.replace(/[$,]/g, ''),
    miles: (draft.miles || '0').replace(/[,]/g, ''),
    deadhead: '0',
    type: draft.type || options.defaultEquipment || 'Dry Van',
    status: options.status || 'available',
    deliveryDate: draft.deliveryDate,
    loadRef: draft.loadRef?.trim(),
    broker: draft.broker?.trim(),
    dispatchDate: draft.dispatchDate,
    pickupDate: draft.pickupDate,
    lineHaul: draft.lineHaul?.replace(/[$,]/g, ''),
    accessorials: draft.accessorials?.replace(/[$,]/g, ''),
    accessorialDetail: draft.accessorialDetail?.trim(),
    weight: draft.weight?.trim(),
    importNotes: [
      `Imported from rate confirmation (${draft.milesSource || 'manual'} miles).`,
      ...(draft.warnings || []),
    ].join(' '),
    sourceFile: draft.sourceFile,
  };
}

export function isLikelyPodFile(fileName: string): boolean {
  // Filename-only guard for common POD/photo dumps. Content classification happens after extract.
  return /^(CamScanner |Picture|Class 9|TruckParking|Dispatch Fax)/i.test(fileName.trim());
}
