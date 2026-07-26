import { Link } from 'react-router';
import { getLoadCityStates, type Load } from '@silver-crown/shared';
import LoadRouteMap from './LoadRouteMap';

export function statusLabel(status: Load['status']) {
  if (status === 'in_transit') return 'In Transit';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function statusPillClass(status: Load['status']) {
  return status === 'delivered'
    ? 'bg-surface-container-high text-on-surface-variant'
    : 'bg-primary/20 text-primary';
}

export function deadheadOrDelivery(load: Load): { label: string; value: string } {
  if (load.status === 'delivered') {
    return {
      label: 'Delivery',
      value: load.deliveryDate ? new Date(load.deliveryDate).toLocaleDateString() : '—',
    };
  }
  return { label: 'Deadhead', value: `${load.deadhead || '0'} mi` };
}

interface LoadCardProps {
  load: Load;
}

export default function LoadCard({ load }: LoadCardProps) {
  const { label: rightLabel, value: rightValue } = deadheadOrDelivery(load);
  const cities = getLoadCityStates(load);

  return (
    <Link
      to={`/loads/${load.id}`}
      className="block bg-surface-container border border-outline-variant rounded-lg overflow-hidden hover:border-primary transition-colors group"
    >
      <LoadRouteMap
        stops={load.stops}
        originCoords={load.originCoords}
        destCoords={load.destCoords}
        height="140px"
        interactive={false}
      />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2
            className="font-[family-name:var(--font-bebas)] text-2xl tracking-wide leading-tight uppercase group-hover:text-primary transition-colors"
            title={`${load.origin} → ${load.destination}`}
          >
            {cities.pickup} <span className="text-primary">→</span> {cities.dropoff}
          </h2>
          <span
            className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${statusPillClass(load.status)}`}
          >
            {statusLabel(load.status)}
          </span>
        </div>
        {(load.loadRef || load.broker) && (
          <p className="text-on-surface-variant text-xs mb-3">
            {[load.loadRef, load.broker].filter(Boolean).join(' · ')}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
          <div>
            <p className="text-on-surface-variant text-[10px] uppercase tracking-wider">Gross Pay</p>
            <p className="text-primary font-bold">${load.payout}</p>
          </div>
          <div className="text-center">
            <p className="text-on-surface-variant text-[10px] uppercase tracking-wider">Total Miles</p>
            <p className="font-bold">{load.miles} mi</p>
          </div>
          <div className="text-right">
            <p className="text-on-surface-variant text-[10px] uppercase tracking-wider">{rightLabel}</p>
            <p className="font-bold">{rightValue}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-on-surface-variant border-t border-outline-variant pt-3">
          <span>{load.type}</span>
          <span>{load.assignedDriverName || 'Unassigned'}</span>
        </div>
      </div>
    </Link>
  );
}
