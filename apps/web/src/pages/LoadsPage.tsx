import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Plus, Search } from 'lucide-react';
import { subscribeCompanyLoads, getCompanyDrivers, assignLoadToDriver } from '@silver-crown/shared';
import type { Load, AppUser } from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';

export default function LoadsPage() {
  const { profile } = useAuth();
  const [loads, setLoads] = useState<Load[]>([]);
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');

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
      (l.assignedDriverName || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchesDriver = driverFilter === 'all' || l.assignedDriverId === driverFilter;
    return matchesSearch && matchesStatus && matchesDriver;
  });

  const handleAssign = async (loadId: string, driverId: string) => {
    const driver = drivers.find((d) => d.uid === driverId);
    if (!driver) return;
    await assignLoadToDriver(loadId, driverId, driver.displayName);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wider">LOADS</h1>
        <Link to="/loads/new" className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wider hover:opacity-90">
          <Plus size={16} /> New Load
        </Link>
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
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm">
          <option value="all">All Status</option>
          <option value="available">Available</option>
          <option value="in_transit">In Transit</option>
          <option value="delivered">Delivered</option>
        </select>
        <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} className="bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm">
          <option value="all">All Drivers</option>
          {drivers.map((d) => <option key={d.uid} value={d.uid}>{d.displayName}</option>)}
        </select>
      </div>

      <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wider">
              <th className="text-left p-4">Route</th>
              <th className="text-left p-4">Type</th>
              <th className="text-left p-4">Payout</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Driver</th>
              <th className="text-left p-4">Assign</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((load) => (
              <tr key={load.id} className="border-b border-outline-variant hover:bg-surface-container-high">
                <td className="p-4">
                  <span className="font-[family-name:var(--font-bebas)] text-lg">{load.origin} → {load.destination}</span>
                  <p className="text-on-surface-variant text-xs">{load.miles} mi</p>
                </td>
                <td className="p-4">{load.type}</td>
                <td className="p-4 text-primary font-bold">${load.payout}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                    load.status === 'delivered' ? 'bg-surface-container-high text-on-surface-variant' : 'bg-primary/20 text-primary'
                  }`}>{load.status}</span>
                </td>
                <td className="p-4">{load.assignedDriverName || '—'}</td>
                <td className="p-4">
                  <select
                    value={load.assignedDriverId || ''}
                    onChange={(e) => e.target.value && handleAssign(load.id, e.target.value)}
                    className="bg-surface-container-high border border-outline-variant rounded px-2 py-1 text-xs text-on-surface"
                  >
                    <option value="">Assign...</option>
                    {drivers.map((d) => <option key={d.uid} value={d.uid}>{d.displayName}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-on-surface-variant py-12">No loads found.</p>}
      </div>
    </div>
  );
}
