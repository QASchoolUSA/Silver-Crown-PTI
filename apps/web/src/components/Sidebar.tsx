import { NavLink } from 'react-router';
import { LayoutDashboard, Truck, ClipboardList, Users, Ticket, LogOut } from 'lucide-react';
import { signOut } from '@silver-crown/shared';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/loads', icon: Truck, label: 'Loads' },
  { to: '/inspections', icon: ClipboardList, label: 'Inspections' },
  { to: '/drivers', icon: Users, label: 'Drivers' },
  { to: '/invite-codes', icon: Ticket, label: 'Invite Codes' },
];

export default function Sidebar() {
  const { profile } = useAuth();

  return (
    <aside className="w-64 bg-surface-container-low border-r border-outline-variant flex flex-col">
      <div className="p-6 border-b border-outline-variant">
        <h1 className="font-[family-name:var(--font-bebas)] text-3xl text-primary tracking-widest">SILVER CROWN</h1>
        <p className="text-on-surface-variant text-xs uppercase tracking-wider mt-1">Admin Dashboard</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-primary/20 text-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-outline-variant">
        <p className="text-on-surface text-sm font-semibold px-4 mb-1">{profile?.displayName}</p>
        <p className="text-on-surface-variant text-xs px-4 mb-3">{profile?.email}</p>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-2 w-full px-4 py-2 text-error text-sm font-semibold hover:bg-error-container/20 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
