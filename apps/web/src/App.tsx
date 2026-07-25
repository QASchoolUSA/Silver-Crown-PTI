import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LoadsPage from './pages/LoadsPage';
import LoadDetailPage from './pages/LoadDetailPage';
import NewLoadPage from './pages/NewLoadPage';
import InspectionsPage from './pages/InspectionsPage';
import InspectionDetailPage from './pages/InspectionDetailPage';
import DriversPage from './pages/DriversPage';
import DriverDetailPage from './pages/DriverDetailPage';
import InviteCodesPage from './pages/InviteCodesPage';
import DocumentsPage from './pages/DocumentsPage';
import { firebaseInitError } from './lib/firebase';

function FirebaseSetupScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-8">
      <div className="w-full max-w-lg text-center">
        <h1 className="font-[family-name:var(--font-bebas)] text-5xl text-primary tracking-widest">
          SILVER CROWN
        </h1>
        <p className="text-on-surface-variant text-sm uppercase tracking-wider mt-2 mb-8">
          Setup required
        </p>
        <p className="text-on-surface mb-6">{message}</p>
        <ol className="text-left text-on-surface-variant text-sm space-y-3 list-decimal list-inside">
          <li>
            Copy <code className="text-primary">.env.example</code> to{' '}
            <code className="text-primary">.env</code> at the repo root
          </li>
          <li>
            Fill in Firebase credentials, or set{' '}
            <code className="text-primary">VITE_USE_FIREBASE_EMULATORS=true</code> for local
            emulators
          </li>
          <li>
            Restart <code className="text-primary">pnpm dev:web</code>
          </li>
        </ol>
      </div>
    </div>
  );
}

export default function App() {
  if (firebaseInitError) {
    return <FirebaseSetupScreen message={firebaseInitError} />;
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AdminLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/loads" element={<LoadsPage />} />
            <Route path="/loads/new" element={<NewLoadPage />} />
            <Route path="/loads/:id" element={<LoadDetailPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/inspections" element={<InspectionsPage />} />
            <Route path="/inspections/:id" element={<InspectionDetailPage />} />
            <Route path="/drivers" element={<DriversPage />} />
            <Route path="/drivers/:id" element={<DriverDetailPage />} />
            <Route path="/invite-codes" element={<InviteCodesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
