import type { RateConDraft, RateConStop } from '@silver-crown/shared';

export type ManualFieldKey = 'broker' | 'loadRef' | 'pickup' | 'dropoff' | 'payout';

export interface ManualCaptureStep {
  key: ManualFieldKey;
  label: string;
  hint: string;
  /** Soft accent for highlight overlays */
  color: string;
}

export const MANUAL_CAPTURE_STEPS: ManualCaptureStep[] = [
  {
    key: 'broker',
    label: 'Broker Name',
    hint: 'Draw a box around the broker / company name on the rate confirmation.',
    color: 'rgba(137, 206, 255, 0.35)',
  },
  {
    key: 'loadRef',
    label: 'Load ID',
    hint: 'Highlight the load number, rate confirmation #, or load ID.',
    color: 'rgba(129, 199, 132, 0.35)',
  },
  {
    key: 'pickup',
    label: 'Pick Up Location',
    hint: 'Select the pickup address (street, city, state).',
    color: 'rgba(255, 183, 77, 0.35)',
  },
  {
    key: 'dropoff',
    label: 'Drop Off Location',
    hint: 'Select a delivery address. You can add more dropoffs after this one.',
    color: 'rgba(240, 98, 146, 0.35)',
  },
  {
    key: 'payout',
    label: 'Gross Pay / Total Pay',
    hint: 'Highlight the total rate, gross pay, or flat rate amount.',
    color: 'rgba(186, 104, 200, 0.35)',
  },
];

export interface PageHighlightRect {
  page: number;
  /** Normalized 0–1 relative to rendered page size */
  x: number;
  y: number;
  width: number;
  height: number;
  fieldKey: ManualFieldKey;
  /** Distinguishes multiple dropoffs */
  instanceId: string;
  label: string;
  color: string;
}

export interface ManualCaptures {
  broker: string;
  loadRef: string;
  pickup: string;
  dropoffs: string[];
  payout: string;
  highlights: PageHighlightRect[];
}

export function emptyManualCaptures(): ManualCaptures {
  return {
    broker: '',
    loadRef: '',
    pickup: '',
    dropoffs: [],
    payout: '',
    highlights: [],
  };
}

export function normalizeCapturedText(raw: string): string {
  return raw
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function cleanBroker(raw: string): string {
  return normalizeCapturedText(raw).replace(/\s+/g, ' ');
}

export function cleanLoadRef(raw: string): string {
  return normalizeCapturedText(raw)
    .replace(/^(load\s*(id|#|number|no\.?)|rate\s*con(firmation)?\s*(#|no\.?)?|confirmation\s*(#|no\.?)?)\s*[:#]?\s*/i, '')
    .trim();
}

export function cleanAddress(raw: string): string {
  return normalizeCapturedText(raw)
    .replace(/\n+/g, ', ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanPayout(raw: string): string {
  const normalized = normalizeCapturedText(raw);
  const match = normalized.replace(/,/g, '').match(/\$?\s*(-?\d+(?:\.\d{1,2})?)/);
  if (match) return match[1];
  return normalized.replace(/[^0-9.]/g, '');
}

export function buildDraftFromManualCaptures(
  captures: ManualCaptures,
  meta: {
    sourceFile: string;
    documentId?: string;
    assignedDriverId?: string | null;
    assignedDriverName?: string;
  }
): RateConDraft {
  const stops: RateConStop[] = [];
  const pickup = cleanAddress(captures.pickup);
  if (pickup) {
    stops.push({ type: 'pickup', address: pickup, sequence: 0 });
  }
  captures.dropoffs.forEach((dropoff, index) => {
    const address = cleanAddress(dropoff);
    if (address) {
      stops.push({ type: 'dropoff', address, sequence: index });
    }
  });

  const payout = cleanPayout(captures.payout);

  return {
    sourceFile: meta.sourceFile,
    documentId: meta.documentId,
    broker: cleanBroker(captures.broker) || undefined,
    loadRef: cleanLoadRef(captures.loadRef) || undefined,
    payout: payout || undefined,
    assignedDriverId: meta.assignedDriverId ?? null,
    assignedDriverName: meta.assignedDriverName,
    stops,
    milesSource: 'manual',
    confidence: 1,
    warnings: ['Fields captured manually from the rate confirmation PDF.'],
  };
}

export function stepForKey(key: ManualFieldKey): ManualCaptureStep {
  return MANUAL_CAPTURE_STEPS.find((step) => step.key === key) ?? MANUAL_CAPTURE_STEPS[0];
}
