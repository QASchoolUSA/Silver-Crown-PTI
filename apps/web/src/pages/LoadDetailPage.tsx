import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, MapPin, Truck, User, Calendar, DollarSign, Route } from 'lucide-react';
import {
  getLoadById,
  getCompanyDrivers,
  assignLoadToDriver,
  updateLoadStatus,
} from '@silver-crown/shared';
import type { Load, AppUser, LoadStatus } from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';
import LoadRouteMap from '../components/LoadRouteMap';
import RouteWeatherPanel from '../components/RouteWeatherPanel';

function statusLabel(status: LoadStatus) {
  if (status === 'in_transit') return 'In Transit';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function LoadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [load, setLoad] = useState<Load | null>(null);
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id || !profile?.companyId) return;
    setLoading(true);
    Promise.all([getLoadById(id), getCompanyDrivers(profile.companyId)])
      .then(([loadData, driverList]) => {
        setLoad(loadData);
        setDrivers(driverList);
      })
      .finally(() => setLoading(false));
  }, [id, profile?.companyId]);

  const handleAssign = async (driverId: string) => {
    if (!load || !driverId) return;
    const driver = drivers.find((d) => d.uid === driverId);
    if (!driver) return;
    setUpdating(true);
    try {
      await assignLoadToDriver(load.id, driverId, driver.displayName);
      setLoad({ ...load, assignedDriverId: driverId, assignedDriverName: driver.displayName });
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusChange = async (status: LoadStatus) => {
    if (!load) return;
    setUpdating(true);
    try {
      const deliveryDate = status === 'delivered' ? new Date().toISOString() : undefined;
      await updateLoadStatus(load.id, status, deliveryDate);
      setLoad({ ...load, status, deliveryDate: deliveryDate ?? load.deliveryDate });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!load) {
    return (
      <div>
        <Link to="/loads" className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary text-sm mb-6">
          <ArrowLeft size={16} /> Back to Loads
        </Link>
        <p className="text-on-surface-variant">Load not found.</p>
      </div>
    );
  }

  const statusOptions: LoadStatus[] = ['available', 'in_transit', 'delivered'];

  return (
    <div className="max-w-4xl">
      <Link
        to="/loads"
        className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Loads
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wider uppercase leading-tight">
            {load.origin} <span className="text-primary">→</span> {load.destination}
          </h1>
          <p className="text-on-surface-variant mt-2 text-sm">Created {formatDate(load.createdAt)}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
            load.status === 'delivered'
              ? 'bg-surface-container-high text-on-surface-variant'
              : 'bg-primary/20 text-primary'
          }`}
        >
          {statusLabel(load.status)}
        </span>
      </div>

      <div className="rounded-lg overflow-hidden border border-outline-variant mb-6">
        <LoadRouteMap
          originCoords={load.originCoords}
          destCoords={load.destCoords}
          height="360px"
          interactive
        />
        <div className="flex items-center justify-between px-4 py-2 bg-surface-container-high text-xs text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-on-surface-variant" />
            Origin — {load.origin}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary" />
            Destination — {load.destination}
          </span>
        </div>
      </div>

      <RouteWeatherPanel
        originLabel={load.origin}
        destinationLabel={load.destination}
        originCoords={load.originCoords}
        destCoords={load.destCoords}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {[
          { icon: DollarSign, label: 'Payout', value: `$${load.payout}` },
          { icon: Route, label: 'Total Miles', value: `${load.miles} mi` },
          { icon: MapPin, label: 'Deadhead', value: `${load.deadhead || '0'} mi` },
          { icon: Truck, label: 'Equipment', value: load.type },
          { icon: User, label: 'Driver', value: load.assignedDriverName || 'Unassigned' },
          {
            icon: Calendar,
            label: load.status === 'delivered' ? 'Delivered' : 'Delivery Date',
            value: formatDate(load.deliveryDate),
          },
        ].map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="bg-surface-container border border-outline-variant rounded-lg p-4"
          >
            <div className="flex items-center gap-2 text-on-surface-variant text-[10px] uppercase tracking-wider mb-1">
              <Icon size={12} />
              {label}
            </div>
            <p className="font-bold text-sm">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface-container border border-outline-variant rounded-lg p-5 space-y-5">
        <div>
          <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
            Assign Driver
          </label>
          <select
            value={load.assignedDriverId || ''}
            disabled={updating}
            onChange={(e) => handleAssign(e.target.value)}
            className="w-full max-w-sm bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm disabled:opacity-50"
          >
            <option value="">Select driver...</option>
            {drivers.map((d) => (
              <option key={d.uid} value={d.uid}>
                {d.displayName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
            Update Status
          </label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => (
              <button
                key={status}
                type="button"
                disabled={updating || load.status === status}
                onClick={() => handleStatusChange(status)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${
                  load.status === status
                    ? 'bg-primary text-on-primary'
                    : 'border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'
                }`}
              >
                {statusLabel(status)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
