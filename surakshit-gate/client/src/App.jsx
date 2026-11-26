import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout, { HOME } from './ui/Layout.jsx';
import Login from './pages/Login.jsx';
import More from './pages/More.jsx';
import { Spinner } from './ui/bits.jsx';
import { t } from './i18n.jsx';

const GatePage = lazy(() => import('./pages/gate/GatePage.jsx'));
const NewPickup = lazy(() => import('./pages/gate/NewPickup.jsx'));
const PickupScreen = lazy(() => import('./pages/gate/PickupScreen.jsx'));
const ParentPage = lazy(() => import('./pages/parent/ParentPage.jsx'));
const Today = lazy(() => import('./pages/reports/Today.jsx'));
const Monthly = lazy(() => import('./pages/reports/Monthly.jsx'));
const Pickups = lazy(() => import('./pages/reports/Pickups.jsx'));
const Alerts = lazy(() => import('./pages/reports/Alerts.jsx'));
const Teacher = lazy(() => import('./pages/teacher/Teacher.jsx'));
const Students = lazy(() => import('./pages/admin/Students.jsx'));
const Cards = lazy(() => import('./pages/admin/Cards.jsx'));
const Users = lazy(() => import('./pages/admin/Users.jsx'));
const Settings = lazy(() => import('./pages/admin/Settings.jsx'));
const Messages = lazy(() => import('./pages/admin/Messages.jsx'));

function Guard({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user.role)) return <Navigate to={HOME[user.role]} replace />;
  return children;
}

const G = ['guard', 'admin', 'principal'];
const OFFICE = ['admin', 'principal'];

export default function App() {
  const { loading, user } = useAuth();
  if (loading) return <Spinner label={t('खुल रहा है…')} />;
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {/* parent's secure link: no login */}
        <Route path="/p/:token" element={<ParentPage />} />
        {!user ? (
          <Route path="*" element={<Login />} />
        ) : (
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to={HOME[user.role]} replace />} />
            <Route path="/gate" element={<Guard roles={G}><GatePage /></Guard>} />
            <Route path="/gate/pickup/new/:studentId" element={<Guard roles={G}><NewPickup /></Guard>} />
            <Route path="/gate/pickup/:id" element={<Guard roles={G}><PickupScreen /></Guard>} />
            <Route path="/today" element={<Guard roles={OFFICE}><Today /></Guard>} />
            <Route path="/monthly" element={<Guard roles={OFFICE}><Monthly /></Guard>} />
            <Route path="/pickups" element={<Guard roles={OFFICE}><Pickups /></Guard>} />
            <Route path="/alerts" element={<Guard roles={OFFICE}><Alerts /></Guard>} />
            <Route path="/teacher" element={<Guard roles={['teacher', ...OFFICE]}><Teacher /></Guard>} />
            <Route path="/students" element={<Guard roles={OFFICE}><Students /></Guard>} />
            <Route path="/cards" element={<Guard roles={OFFICE}><Cards /></Guard>} />
            <Route path="/messages" element={<Guard roles={OFFICE}><Messages /></Guard>} />
            <Route path="/users" element={<Guard roles={['admin']}><Users /></Guard>} />
            <Route path="/settings" element={<Guard roles={['admin']}><Settings /></Guard>} />
            <Route path="/more" element={<More />} />
            <Route path="*" element={<Navigate to={HOME[user.role]} replace />} />
          </Route>
        )}
      </Routes>
    </Suspense>
  );
}
