import type { LoadStop } from '../types';
import {
  createStopDraftFromStop,
  draftsToStops,
  initialStopDrafts,
  type StopDraft,
} from '../utils/stopDrafts';

const pickup = (address: string, sequence: number): LoadStop => ({
  type: 'pickup',
  address,
  coords: { latitude: 41.88, longitude: -87.63 },
  sequence,
});

const dropoff = (address: string, sequence: number): LoadStop => ({
  type: 'dropoff',
  address,
  coords: { latitude: 32.77, longitude: -96.79 },
  sequence,
});

describe('initialStopDrafts', () => {
  it('returns one empty pickup and one empty dropoff', () => {
    const { pickups, dropoffs } = initialStopDrafts();
    expect(pickups).toHaveLength(1);
    expect(dropoffs).toHaveLength(1);
    expect(pickups[0]).toEqual({ query: '', stop: null });
  });
});

describe('createStopDraftFromStop', () => {
  it('copies address into query and stop', () => {
    const stop = pickup('123 Main St', 0);
    expect(createStopDraftFromStop(stop)).toEqual({ query: '123 Main St', stop });
  });
});

describe('draftsToStops', () => {
  it('returns null when any draft lacks a confirmed stop', () => {
    const pickups: StopDraft[] = [{ query: 'typing…', stop: null }];
    const dropoffs: StopDraft[] = [createStopDraftFromStop(dropoff('456 Oak', 0))];
    expect(draftsToStops(pickups, dropoffs)).toBeNull();
  });

  it('combines confirmed pickups and dropoffs with sequences', () => {
    const pickups: StopDraft[] = [
      createStopDraftFromStop(pickup('A', 0)),
      createStopDraftFromStop(pickup('B', 1)),
    ];
    const dropoffs: StopDraft[] = [createStopDraftFromStop(dropoff('C', 0))];
    const stops = draftsToStops(pickups, dropoffs);
    expect(stops).toHaveLength(3);
    expect(stops![0].sequence).toBe(0);
    expect(stops![1].sequence).toBe(1);
    expect(stops![2].type).toBe('dropoff');
  });
});
