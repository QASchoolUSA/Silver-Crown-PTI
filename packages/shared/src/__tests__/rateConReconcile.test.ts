import type { RateConDraft } from '../types';
import { isUsableRateConDraft, reconcileRateConDraft } from '../utils/rateConReconcile';

describe('rateConReconcile', () => {
  const base: RateConDraft = {
    sourceFile: 'rc.pdf',
    loadRef: 'ABC-100',
    payout: '2500',
    lineHaul: '2300',
    accessorials: '200',
    miles: '500',
    confidence: 0.95,
    stops: [
      { type: 'pickup', address: '100 Main St, Chicago, IL 60601', sequence: 0 },
      { type: 'dropoff', address: '200 Elm St, Dallas, TX 75201', sequence: 0 },
    ],
  };

  it('keeps high confidence when fields reconcile', () => {
    const result = reconcileRateConDraft({ ...base });
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.warnings?.some((w) => w.startsWith('Error:'))).toBe(false);
  });

  it('flags missing load number and remit-to addresses', () => {
    const result = reconcileRateConDraft({
      ...base,
      loadRef: '',
      stops: [
        { type: 'pickup', address: 'Remit To: Factoring Co, PO Box 12', sequence: 0 },
        { type: 'dropoff', address: '200 Elm St, Dallas, TX 75201', sequence: 0 },
      ],
    });
    expect(result.confidence!).toBeLessThan(0.5);
    expect(result.warnings?.some((w) => w.includes('Load Number'))).toBe(true);
    expect(result.warnings?.some((w) => w.toLowerCase().includes('remit'))).toBe(true);
  });

  it('isUsableRateConDraft requires stop plus pay or ref', () => {
    expect(isUsableRateConDraft(base)).toBe(true);
    expect(isUsableRateConDraft({ ...base, loadRef: undefined, payout: undefined })).toBe(false);
    expect(isUsableRateConDraft({ ...base, stops: [] })).toBe(false);
  });
});
