import type { AppUser, Load } from '../types';
import { getLoadSummaryLabels } from './loadStops';

export type PeriodPreset =
  | 'jan-jul-2026'
  | '2026-01'
  | '2026-02'
  | '2026-03'
  | '2026-04'
  | '2026-05'
  | '2026-06'
  | '2026-07'
  | 'custom';

export interface PeriodRange {
  start: Date;
  end: Date;
  label: string;
}

export interface LoadStatsSummary {
  grossPay: number;
  driverPay: number;
  totalMiles: number;
  loadCount: number;
  dispatchSharePct: number;
}

export function parsePayoutAmount(payout: string | undefined): number {
  if (!payout) return 0;
  const num = parseFloat(payout.replace(/[$,\s]/g, ''));
  return Number.isNaN(num) ? 0 : num;
}

export function parseMilesAmount(miles: string | undefined): number {
  if (!miles) return 0;
  const num = parseFloat(miles.replace(/[,]/g, ''));
  return Number.isNaN(num) ? 0 : num;
}

export function getLoadDispatchDate(load: Load): Date | null {
  const raw = load.dispatchDate || load.createdAt;
  if (!raw) return null;
  const date = new Date(raw.length === 10 ? `${raw}T12:00:00.000Z` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getPeriodRange(preset: PeriodPreset, customStart?: string, customEnd?: string): PeriodRange {
  if (preset === 'custom' && customStart && customEnd) {
    return {
      start: new Date(`${customStart}T00:00:00.000Z`),
      end: new Date(`${customEnd}T23:59:59.999Z`),
      label: `${customStart} – ${customEnd}`,
    };
  }

  if (preset === 'jan-jul-2026') {
    return {
      start: new Date('2026-01-01T00:00:00.000Z'),
      end: new Date('2026-07-31T23:59:59.999Z'),
      label: 'Jan–Jul 2026',
    };
  }

  const [year, month] = preset.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const label = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  return { start, end, label };
}

export function filterLoadsByPeriod(loads: Load[], period: PeriodRange): Load[] {
  return loads.filter((load) => {
    const date = getLoadDispatchDate(load);
    if (!date) return false;
    return date >= period.start && date <= period.end;
  });
}

export function filterLoadsByDriver(loads: Load[], driverId: string | 'all'): Load[] {
  if (driverId === 'all') return loads;
  return loads.filter((load) => load.assignedDriverId === driverId);
}

export function getDispatchSharePct(driver: AppUser | null | undefined): number {
  return driver?.payrollSummary?.dispatchSharePct ?? 33;
}

export function computeLoadStats(
  loads: Load[],
  dispatchSharePct = 33
): LoadStatsSummary {
  const grossPay = loads.reduce((sum, load) => sum + parsePayoutAmount(load.payout), 0);
  const totalMiles = loads.reduce((sum, load) => sum + parseMilesAmount(load.miles), 0);
  const driverPay = grossPay * (dispatchSharePct / 100);

  return {
    grossPay,
    driverPay,
    totalMiles,
    loadCount: loads.length,
    dispatchSharePct,
  };
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatMilesTotal(miles: number): string {
  return miles.toLocaleString('en-US');
}

export function getPickupLabel(load: Load): string {
  const summary = getLoadSummaryLabels(load);
  return summary.origin;
}

export function getDropoffLabel(load: Load): string {
  const summary = getLoadSummaryLabels(load);
  return summary.destination;
}
