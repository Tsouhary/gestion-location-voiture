import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import Login from './pages/Login/Login.jsx';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import Vehicles from './pages/Vehicles/Vehicles.jsx';
import VehicleDetail from './pages/Vehicles/VehicleDetail.jsx';
import Drivers from './pages/Drivers/Drivers.jsx';
import Reservations from './pages/Reservations/Reservations.jsx';
import Maintenance from './pages/Maintenance/Maintenance.jsx';
import Users from './pages/Users/Users.jsx';
import Profile from './pages/Profile/Profile.jsx';
import Invoices from './pages/Billing/Invoices.jsx';
import InvoiceView from './pages/Billing/InvoiceView.jsx';
import ReceiptView from './pages/Billing/ReceiptView.jsx';
import ContractView from './pages/Contracts/ContractView.jsx';
import Settings from './pages/Settings/Settings.jsx';
import { ConfirmHost } from './components/ui.jsx';

// Les restrictions de rôle côté interface ne sont qu'un confort : c'est l'API qui fait autorité.
export default function App() {
  return (
    <>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="vehicles/:id" element={<VehicleDetail />} />
          <Route path="reservations" element={<Reservations />} />
          <Route path="profile" element={<Profile />} />
          <Route path="contracts/:reservationId" element={<ContractView />} />
          <Route element={<ProtectedRoute roles={['admin', 'manager', 'user']} />}>
            <Route path="invoices" element={<Invoices />} />
            <Route path="invoices/:id" element={<InvoiceView />} />
            <Route path="receipts/:id" element={<ReceiptView />} />
          </Route>
          <Route element={<ProtectedRoute roles={['admin', 'manager']} />}>
            <Route path="drivers" element={<Drivers />} />
            <Route path="maintenance" element={<Maintenance />} />
          </Route>
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="users" element={<Users />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <ConfirmHost />
    </>
  );
}
