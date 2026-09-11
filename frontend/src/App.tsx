import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { AcceptInvitationPage } from './pages/auth/AcceptInvitationPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { OrganizationPage } from './pages/organization/OrganizationPage';
import { MembersPage } from './pages/organization/MembersPage';
import { DomainsPage } from './pages/domains/DomainsPage';
import { InventoryPage } from './pages/inventory/InventoryPage';
import { AssetDetailsPage } from './pages/inventory/AssetDetailsPage';
import { AssetGraphPage } from './pages/inventory/AssetGraphPage';
import { RisksPage } from './pages/risks/RisksPage';
import { RiskDetailPage } from './pages/risks/RiskDetailPage';
import { BrandProtectionPage } from './pages/brand-protection/BrandProtectionPage';
import { CompliancePage } from './pages/compliance/CompliancePage';
import { ScenariosPage } from './pages/scenarios/ScenariosPage';
import { VendorRiskPage } from './pages/vendors/VendorRiskPage';
import { ThreatLandscapePage } from './pages/threat-landscape/ThreatLandscapePage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/invitations/:token/accept" element={<AcceptInvitationPage />} />
      
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/organization" element={<OrganizationPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/domains" element={<DomainsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="inventory/:id" element={<AssetDetailsPage />} />
          <Route path="/asset-graph" element={<AssetGraphPage />} />
          <Route path="/risks" element={<RisksPage />} />
          <Route path="/risks/:id" element={<RiskDetailPage />} />
          <Route path="/scenarios" element={<ScenariosPage />} />
          <Route path="/compliance" element={<CompliancePage />} />
          <Route path="/brand-protection" element={<BrandProtectionPage />} />
          <Route path="/vendors" element={<VendorRiskPage />} />
          <Route path="/threat-landscape" element={<ThreatLandscapePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
