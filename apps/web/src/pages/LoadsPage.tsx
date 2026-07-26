import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { LayoutGrid, List, Plus, Search, UploadCloud } from 'lucide-react';
import { getLoadCityStates, subscribeCompanyLoads, getCompanyDrivers } from '@silver-crown/shared';
import type { Load, AppUser } from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';
import LoadCard, { statusLabel, statusPillClass } from '../components/LoadCard';

type ViewMode = 'grid' | 'list';

const VIEW_MODE_KEY = 'loads-view-mode';

function extraStopsHint(count: number): string | null {
  if (count <= 0) return null;
  return `+${count} ${count === 1 ? 'stop' : 'stops'}`;
}

export default function LoadsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loads, setLoads] = useState<Load[]>([]);
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return localStorage.getItem(VIEW_MODE_KEY) === 'list' ? 'list' : 'grid';
  });

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  useEffect(() => {
    if (!profile?.companyId) return;
    const unsub = subscribeCompanyLoads(profile.companyId, setLoads);
    getCompanyDrivers(profile.companyId).then(setDrivers);
    return unsub;
  }, [profile?.companyId]);

  const filtered = loads.filter((l) => {
    const matchesSearch =
      l.origin.toLowerCase().includes(search.toLowerCase()) ||
      l.destination.toLowerCase().includes(search.toLowerCase()) ||
      (l.assignedDriverName || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.loadRef || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.broker || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchesDriver = driverFilter === 'all' || l.assignedDriverId === driverFilter;
    return matchesSearch && matchesStatus && matchesDriver;
  });

  const openLoad = (loadId: string, newTab = false) => {
    const path = `/loads/${loadId}`;
    if (newTab) {
      window.open(path, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(path);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wider">LOADS</h1>
        <div className="flex items-center gap-3">
          <Link
            to="/loads/import"
            className="flex items-center gap-2 border border-primary text-primary px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wider hover:bg-primary/10"
          >
            <UploadCloud size={16} /> Import Rate Cons
          </Link>
          <Link
            to="/loads/new"
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wider hover:opacity-90"
          >
            <Plus size={16} /> New Load
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2 bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 flex-1 min-w-[200px]">
          <Search size={16} className="text-on-surface-variant" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search loads..."
            className="bg-transparent text-on-surface flex-1 outline-none text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm"
        >
          <option value="all">All Status</option>
          <option value="available">Available</option>
          <option value="in_transit">In Transit</option>
          <option value="delivered">Delivered</option>
        </select>
        <select
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          className="bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm"
        >
          <option value="all">All Drivers</option>
          {drivers.map((d) => (
            <option key={d.uid} value={d.uid}>
              {d.displayName}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
            onClick={() => changeViewMode('grid')}
            className={`flex items-center justify-center px-3 rounded-lg transition-colors ${
              viewMode === 'grid'
                ? 'bg-primary text-on-primary'
                : 'border border-outline-variant text-on-surface-variant hover:border-primary'
            }`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
            onClick={() => changeViewMode('list')}
            className={`flex items-center justify-center px-3 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-primary text-on-primary'
                : 'border border-outline-variant text-on-surface-variant hover:border-primary'
            }`}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((load) => (
            <LoadCard key={load.id} load={load} />
          ))}
        </div>
      ) : (
        filtered.length > 0 && (
          <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wider">
                  <th className="text-left p-4">Pickup</th>
                  <th className="text-left p-4">Drop-off</th>
                  <th className="text-left p-4">Broker</th>
                  <th className="text-left p-4">Load #</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Gross Pay</th>
                  <th className="text-left p-4">Miles</th>
                  <th className="text-left p-4">Type</th>
                  <th className="text-left p-4">Driver</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((load) => {
                  const cities = getLoadCityStates(load);
                  const pickupHint = extraStopsHint(cities.extraPickups);
                  const dropoffHint = extraStopsHint(cities.extraDropoffs);

                  return (
                    <tr
                      key={load.id}
                      role="link"
                      tabIndex={0}
                      aria-label={`Open load ${cities.pickup} to ${cities.dropoff}`}
                      className="border-b border-outline-variant last:border-b-0 hover:bg-surface-container-high cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px]"
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey) {
                          openLoad(load.id, true);
                          return;
                        }
                        openLoad(load.id);
                      }}
                      onAuxClick={(e) => {
                        if (e.button === 1) {
                          e.preventDefault();
                          openLoad(load.id, true);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openLoad(load.id, e.metaKey || e.ctrlKey);
                        }
                      }}
                    >
                      <td className="p-4 max-w-[10rem]">
                        <p className="font-semibold truncate" title={load.origin}>
                          {cities.pickup}
                        </p>
                        {pickupHint && (
                          <p className="text-[10px] text-on-surface-variant mt-0.5">{pickupHint}</p>
                        )}
                      </td>
                      <td className="p-4 max-w-[10rem]">
                        <p className="font-semibold truncate" title={load.destination}>
                          {cities.dropoff}
                        </p>
                        {dropoffHint && (
                          <p className="text-[10px] text-on-surface-variant mt-0.5">{dropoffHint}</p>
                        )}
                      </td>
                      <td className="p-4 text-on-surface-variant max-w-[9rem]">
                        <p className="truncate" title={load.broker || undefined}>
                          {load.broker || '—'}
                        </p>
                      </td>
                      <td className="p-4 text-on-surface-variant max-w-[8rem]">
                        <p className="truncate" title={load.loadRef || undefined}>
                          {load.loadRef || '—'}
                        </p>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-[10px] font-bold uppercase ${statusPillClass(load.status)}`}
                        >
                          {statusLabel(load.status)}
                        </span>
                      </td>
                      <td className="p-4 text-primary font-bold">${load.payout}</td>
                      <td className="p-4 text-on-surface-variant">{load.miles} mi</td>
                      <td className="p-4 text-on-surface-variant">{load.type}</td>
                      <td className="p-4 text-on-surface-variant">
                        {load.assignedDriverName || 'Unassigned'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {filtered.length === 0 && (
        <p className="text-center text-on-surface-variant py-12">No loads found.</p>
      )}
    </div>
  );
}
