import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import CustomerPage from './pages/CustomerPage.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/customer/:id" element={<CustomerPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
