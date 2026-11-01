import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AppLayout } from './components/layout/AppLayout';

// Pages
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { GroupsListPage } from './pages/GroupsListPage';
import { CreateGroupPage } from './pages/CreateGroupPage';
import { GroupDetailsPage } from './pages/GroupDetailsPage';
import { AddExpensePage } from './pages/AddExpensePage';
import { ReceiptPipelinePage } from './pages/ReceiptPipelinePage';
import { BalancesPage } from './pages/BalancesPage';
import { HistoryPage } from './pages/HistoryPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Landing & Showcase */}
          <Route path="/" element={<LandingPage />} />

          {/* Authentication & Onboarding */}
          <Route path="/login" element={<AuthPage />} />
          <Route path="/signup" element={<AuthPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />

          {/* Authenticated Application Shell */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/groups" element={<GroupsListPage />} />
            <Route path="/groups/create" element={<CreateGroupPage />} />
            <Route path="/groups/:groupId" element={<GroupDetailsPage />} />
            <Route path="/expenses" element={<Navigate to="/expenses/add" replace />} />
            <Route path="/expenses/add" element={<AddExpensePage />} />
            <Route path="/receipt/pipeline" element={<ReceiptPipelinePage />} />
            <Route path="/receipt/upload" element={<Navigate to="/receipt/pipeline" replace />} />
            <Route path="/balances" element={<BalancesPage />} />
            <Route path="/settlement/smart" element={<Navigate to="/balances" replace />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
