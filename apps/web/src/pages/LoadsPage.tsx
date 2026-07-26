import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { LayoutGrid, List, Plus, Search, UploadCloud } from 'lucide-react';
import { subscribeCompanyLoads, getCompanyDrivers } from '@silver-crown/shared';
import type { Load, AppUser } from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';
import LoadCard, { statusLabel, statusPillClass, deadheadOrDelivery } from '../components/LoadCard';

type ViewMode = 'grid' | 'list';

const VIEW_MODE_KEY = 'loads-view-mode';

export default function LoadsPage() {
  const { profile } = useAuth();
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
                  <th className="text-left p-4">Route</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Gross Pay</th>
                  <th className="text-left p-4">Miles</th>
                  <th className="text-left p-4">Deadhead / Delivery</th>
                  <th className="text-left p-4">Type</th>
                  <th className="text-left p-4">Driver</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((load) => {
                  const { value: rightValue } = deadheadOrDelivery(load);
                  return (
                    <tr
                      key={load.id}
                      className="border-b border-outline-variant last:border-b-0 hover:bg-surface-container-high"
                    >
                      <td className="p-4">
                        <Link
                          to={`/loads/${load.id}`}
                          className="font-semibold hover:text-primary transition-colors"
                        >
                          {load.origin} <span className="text-primary">→</span> {load.destination}
                        </Link>
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
                      <td className="p-4 text-on-surface-variant">{rightValue}</td>
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
