import type { LoadStop, StopType } from '../types';

export interface StopDraft {
  query: string;
  stop: LoadStop | null;
}

function emptyStop(): StopDraft {
  return { query: '', stop: null };
}

export function initialStopDrafts(): { pickups: StopDraft[]; dropoffs: StopDraft[] } {
  return {
    pickups: [emptyStop()],
    dropoffs: [emptyStop()],
  };
}

export function createStopDraftFromStop(stop: LoadStop): StopDraft {
  return { query: stop.address, stop };
}

export function draftsToStops(pickups: StopDraft[], dropoffs: StopDraft[]): LoadStop[] | null {
  const pickupStops = pickups
    .map((d, i) => (d.stop ? { ...d.stop, type: 'pickup' as const, sequence: i } : null))
    .filter(Boolean) as LoadStop[];
  const dropoffStops = dropoffs
    .map((d, i) => (d.stop ? { ...d.stop, type: 'dropoff' as const, sequence: i } : null))
    .filter(Boolean) as LoadStop[];

  if (pickupStops.length === 0 || dropoffStops.length === 0) return null;
  if (pickups.some((d) => !d.stop) || dropoffs.some((d) => !d.stop)) return null;
  return [...pickupStops, ...dropoffStops];
}

export function createEmptyStopDraft(_type: StopType, _sequence: number): StopDraft {
  return emptyStop();
}
