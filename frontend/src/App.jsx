import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/Layout/AppLayout';
import LoginPage from './pages/Auth/LoginPage';
import Dashboard from './pages/Dashboard';
import SoldItems from './pages/SoldItems';
import Payments from './pages/Payments';
import CurrencyExchange from './pages/CurrencyExchange';
import Parties from './pages/Parties';
import PartyDetail from './pages/Parties/PartyDetail';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { PageLoader } from './components/UI/LoadingSpinner';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="sold-items" element={<SoldItems />} />
        <Route path="payments" element={<Payments />} />
        <Route path="currency-exchange" element={<CurrencyExchange />} />
        <Route path="parties" element={<Parties />} />
        <Route path="parties/:id" element={<PartyDetail />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { borderRadius: '10px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' },
            success: { iconTheme: { primary: '#C9A84C', secondary: '#fff' } },
          }}
        />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
