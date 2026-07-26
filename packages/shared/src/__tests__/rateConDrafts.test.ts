import {
  isLikelyPodFile,
  rateConDraftToCreateLoadInput,
  validateRateConDraft,
} from '../utils/rateConDrafts';
import type { RateConDraft } from '../types';

const draft: RateConDraft = {
  sourceFile: 'rate-confirmation.pdf',
  loadRef: 'LD-123',
  broker: 'Example Logistics',
  payout: '$2,450.00',
  miles: '810',
  milesSource: 'rate_con',
  stops: [
    {
      type: 'pickup',
      address: 'Chicago, IL',
      coords: { latitude: 41.88, longitude: -87.63 },
      sequence: 0,
    },
    {
      type: 'dropoff',
      address: 'Dallas, TX',
      coords: { latitude: 32.78, longitude: -96.8 },
      sequence: 0,
    },
  ],
};

describe('rateConDrafts', () => {
  it('validates complete drafts', () => {
    expect(validateRateConDraft(draft)).toEqual({ valid: true, errors: [] });
  });

  it('requires geocoded pickup and dropoff stops', () => {
    const invalid = { ...draft, stops: [{ ...draft.stops[0], coords: undefined }] };
    expect(validateRateConDraft(invalid).valid).toBe(false);
  });

  it('rejects a non-numeric gross rate', () => {
    expect(validateRateConDraft({ ...draft, payout: 'pending' }).valid).toBe(false);
  });

  it('maps a reviewed draft to create-load input', () => {
    const input = rateConDraftToCreateLoadInput('company-1', draft);
    expect(input.payout).toBe('2450.00');
    expect(input.assignedDriverId).toBeNull();
    expect(input.stops).toHaveLength(2);
    expect(input.loadRef).toBe('LD-123');
  });

  it('carries an assigned driver into create-load input', () => {
    const input = rateConDraftToCreateLoadInput('company-1', {
      ...draft,
      assignedDriverId: 'driver-9',
      assignedDriverName: 'Alexey Kedrov',
    });
    expect(input.assignedDriverId).toBe('driver-9');
    expect(input.assignedDriverName).toBe('Alexey Kedrov');
  });

  it('drops a stale driver name when no driver is assigned', () => {
    const input = rateConDraftToCreateLoadInput('company-1', {
      ...draft,
      assignedDriverId: null,
      assignedDriverName: 'Alexey Kedrov',
    });
    expect(input.assignedDriverId).toBeNull();
    expect(input.assignedDriverName).toBeUndefined();
  });

  it('recognizes excluded POD filenames', () => {
    expect(isLikelyPodFile('CamScanner 1-24-26.pdf')).toBe(true);
    expect(isLikelyPodFile('Carrier_Rate_Confirmation_123.pdf')).toBe(false);
    expect(isLikelyPodFile('1_5066584670674618081.pdf')).toBe(false);
  });
});
