import type { RateConDraft } from '../types';

const CORPORATE_KEYWORDS = [
  'remit to',
  'corporate hq',
  'billing office',
  'p.o. box',
  'po box',
  'factoring',
];

function parseMoney(value?: string): number | null {
  if (!value) return null;
  const n = Number.parseFloat(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseMiles(value?: string): number | null {
  if (!value) return null;
  const n = Number.parseFloat(String(value).replace(/[,]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Mathematical & address-quality checks for rate-con drafts (ported from
 * rate-con-pdf-parser FinancialReconciler). Mutates confidence/warnings.
 */
export function reconcileRateConDraft(draft: RateConDraft): RateConDraft {
  const errors: string[] = [];
  const warnings: string[] = [...(draft.warnings || [])];
  let confidencePenalty = 0;

  const payout = parseMoney(draft.payout);
  const lineHaul = parseMoney(draft.lineHaul);
  const accessorials = parseMoney(draft.accessorials);
  const miles = parseMiles(draft.miles);

  if (payout != null && payout <= 0) {
    errors.push('Total price is zero or negative.');
    confidencePenalty += 0.4;
  }

  if (lineHaul != null && accessorials != null && payout != null) {
    const sum = lineHaul + accessorials;
    if (Math.abs(sum - payout) > 0.05) {
      warnings.push(
        `Linehaul ($${lineHaul.toFixed(2)}) + accessorials ($${accessorials.toFixed(2)}) does not match payout ($${payout.toFixed(2)}).`
      );
      confidencePenalty += 0.15;
    }
  } else if (payout == null && lineHaul != null && lineHaul > 0) {
    draft.payout = String(lineHaul + (accessorials || 0));
    warnings.push('Payout derived from linehaul/accessorials.');
  }

  const rpmBase = lineHaul ?? payout;
  if (miles != null && rpmBase != null && miles > 0) {
    const rpm = rpmBase / miles;
    if (rpm < 0.5 || rpm > 15) {
      warnings.push(`Unusual rate-per-mile ($${rpm.toFixed(2)}/mi) for ${miles} miles.`);
    }
  }

  const pickups = draft.stops.filter((s) => s.type === 'pickup');
  const dropoffs = draft.stops.filter((s) => s.type === 'dropoff');

  if (pickups.length === 0) {
    errors.push('Missing pickup (shipper) location.');
    confidencePenalty += 0.25;
  }
  if (dropoffs.length === 0) {
    errors.push('Missing dropoff (consignee) location.');
    confidencePenalty += 0.25;
  }

  for (const stop of draft.stops) {
    const addr = (stop.address || '').toLowerCase();
    if (CORPORATE_KEYWORDS.some((kw) => addr.includes(kw))) {
      errors.push(`Stop address looks like remit/billing, not a facility: "${stop.address}"`);
      confidencePenalty += 0.3;
    }
  }

  const loadRef = draft.loadRef?.trim();
  if (!loadRef || loadRef.length < 2) {
    errors.push('Missing or invalid Load Number.');
    confidencePenalty += 0.3;
  }

  const base = typeof draft.confidence === 'number' ? draft.confidence : 0.9;
  const reconciled = Math.max(0, Math.min(1, base - confidencePenalty));

  return {
    ...draft,
    confidence: Math.round(reconciled * 100) / 100,
    warnings: [...new Set([...warnings, ...errors.map((e) => `Error: ${e}`)])],
  };
}

/** True when draft has enough signal to prefer Gemini over local OCR fallback. */
export function isUsableRateConDraft(draft: RateConDraft | null | undefined): boolean {
  if (!draft) return false;
  const hasStop = draft.stops.some((s) => s.address?.trim());
  const hasPay = parseMoney(draft.payout) != null && parseMoney(draft.payout)! > 0;
  const hasRef = Boolean(draft.loadRef?.trim());
  return hasStop && (hasPay || hasRef);
}
