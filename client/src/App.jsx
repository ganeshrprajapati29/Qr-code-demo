import { lazy, Suspense } from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import Home from './pages/Home.jsx';
import CustomerPage from './pages/CustomerPage.jsx';
import CardRedirect from './pages/CardRedirect.jsx';
import NotFound from './pages/NotFound.jsx';
import BottomNav from './components/BottomNav.jsx';

// the camera library is big - load it only when the scan tab is opened
const ScanPage = lazy(() => import('./pages/ScanPage.jsx'));

function Layout() {
  return (
    <>
      <Suspense fallback={<div className="page"><div className="skeleton" style={{ height: 320, marginTop: 60 }} /></div>}>
        <Outlet />
      </Suspense>
      <BottomNav />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/customer/:id" element={<CustomerPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/c/:token" element={<CardRedirect />} />
    </Routes>
  );
}
