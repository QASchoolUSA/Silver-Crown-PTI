import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';

export default function AdminLayout() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!profile || profile.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-8">
        <div className="text-center">
          <h1 className="font-[family-name:var(--font-bebas)] text-4xl text-primary tracking-wider mb-4">ACCESS DENIED</h1>
          <p className="text-on-surface-variant">This dashboard is for admin users only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
