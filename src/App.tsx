import { Navigate, Route, Routes } from 'react-router-dom';
import { LandingPage } from '@/pages/LandingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AuditPage } from '@/pages/AuditPage';
import { ImpactPage } from '@/pages/ImpactPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/audit" element={<AuditPage />} />
      <Route path="/impact" element={<ImpactPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
