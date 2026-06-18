import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Search } from 'lucide-react';
import { subscribeCompanyInspections, getCompanyDrivers, formatInspectionDate } from '@silver-crown/shared';
import type { Inspection, AppUser } from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';

export default function InspectionsPage() {
  const { profile } = useAuth();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [driverFilter, setDriverFilter] = useState('all');
  const [truckFilter, setTruckFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!profile?.companyId) return;
    const unsub = subscribeCompanyInspections(profile.companyId, setInspections);
    getCompanyDrivers(profile.companyId).then(setDrivers);
    return unsub;
  }, [profile?.companyId]);

  const filtered = inspections.filter((i) => {
    const matchesDriver = driverFilter === 'all' || i.driverId === driverFilter;
    const matchesTruck = !truckFilter || i.truckNumber.toLowerCase().includes(truckFilter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
    return matchesDriver && matchesTruck && matchesStatus;
  });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wider mb-8">INSPECTIONS</h1>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2 bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 flex-1 min-w-[200px]">
          <Search size={16} className="text-on-surface-variant" />
          <input
            value={truckFilter}
            onChange={(e) => setTruckFilter(e.target.value)}
            placeholder="Filter by truck number..."
            className="bg-transparent text-on-surface flex-1 outline-none text-sm"
          />
        </div>
        <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} className="bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm">
          <option value="all">All Drivers</option>
          {drivers.map((d) => <option key={d.uid} value={d.uid}>{d.displayName}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface text-sm">
          <option value="all">All Status</option>
          <option value="PASS">Pass</option>
          <option value="DEFECTS FOUND">Defects Found</option>
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map((item) => (
          <Link
            key={item.id}
            to={`/inspections/${item.id}`}
            className="block bg-surface-container border border-outline-variant rounded-lg p-4 hover:border-primary transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-on-surface">{formatInspectionDate(item.createdAt)}</p>
                <p className="text-on-surface-variant text-sm mt-1">
                  {item.driverName} • Truck: {item.truckNumber}
                  {item.trailerNumber && ` • Trailer: ${item.trailerNumber}`}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                item.status === 'PASS' ? 'bg-primary/20 text-primary' : 'bg-error-container/30 text-error'
              }`}>{item.status}</span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && <p className="text-center text-on-surface-variant py-12">No inspections found.</p>}
      </div>
    </div>
  );
}
