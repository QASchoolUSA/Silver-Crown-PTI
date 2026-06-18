import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Truck, ClipboardList, AlertTriangle } from 'lucide-react';
import { subscribeCompanyLoads, subscribeCompanyInspections } from '@silver-crown/shared';
import type { Load } from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';
import ActiveLoadsMap from '../components/ActiveLoadsMap';

export default function DashboardPage() {
  const { profile } = useAuth();
  const [activeLoads, setActiveLoads] = useState<Load[]>([]);
  const [inspections, setInspections] = useState(0);
  const [defects, setDefects] = useState(0);

  useEffect(() => {
    if (!profile?.companyId) return;
    const unsubLoads = subscribeCompanyLoads(profile.companyId, (data) => {
      setActiveLoads(data.filter((l) => l.status !== 'delivered'));
    });
    const unsubInspections = subscribeCompanyInspections(profile.companyId, (data) => {
      setInspections(data.length);
      setDefects(data.filter((i) => i.status === 'DEFECTS FOUND').length);
    });
    return () => { unsubLoads(); unsubInspections(); };
  }, [profile?.companyId]);

  const stats = [
    { label: 'Active Loads', value: activeLoads.length, icon: Truck, color: 'text-primary' },
    { label: 'Total Inspections', value: inspections, icon: ClipboardList, color: 'text-primary' },
    { label: 'Defects Found', value: defects, icon: AlertTriangle, color: 'text-error' },
  ];

  return (
    <div>
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wider mb-8">DASHBOARD</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-surface-container border border-outline-variant rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">{label}</span>
              <Icon size={20} className={color} />
            </div>
            <p className={`text-4xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            Active Loads Map
          </h2>
          <Link to="/loads" className="text-primary text-xs font-bold uppercase tracking-wider hover:underline">
            View all loads →
          </Link>
        </div>
        <ActiveLoadsMap loads={activeLoads} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/loads/new" className="bg-primary/10 border border-primary rounded-lg p-6 hover:bg-primary/20 transition-colors">
          <h3 className="font-bold text-primary mb-1">Create New Load</h3>
          <p className="text-on-surface-variant text-sm">Assign a load to a driver</p>
        </Link>
        <Link to="/invite-codes" className="bg-surface-container border border-outline-variant rounded-lg p-6 hover:border-primary transition-colors">
          <h3 className="font-bold text-on-surface mb-1">Generate Invite Code</h3>
          <p className="text-on-surface-variant text-sm">Add new drivers or admins</p>
        </Link>
      </div>
    </div>
  );
}
