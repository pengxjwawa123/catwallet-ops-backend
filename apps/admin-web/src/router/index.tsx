import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import RequireAuth from './RequireAuth';
import RequirePermission from './RequirePermission';
import MainLayout from '@/layouts/MainLayout';
import { Spin } from 'antd';
import { PERMISSIONS } from '@/utils/permissions';

const LoginPage        = lazy(() => import('@/pages/login/LoginPage'));
const DashboardPage    = lazy(() => import('@/pages/dashboard/DashboardPage'));
const OpsUsersPage     = lazy(() => import('@/pages/ops-users/OpsUsersPage'));
const RolesPage        = lazy(() => import('@/pages/rbac/RolesPage'));
const PermissionsPage  = lazy(() => import('@/pages/rbac/PermissionsPage'));
const AuditLogsPage    = lazy(() => import('@/pages/audit-logs/AuditLogsPage'));
const FeatureFlagsPage = lazy(() => import('@/pages/feature-flags/FeatureFlagsPage'));
const RemoteConfigsPage= lazy(() => import('@/pages/remote-configs/RemoteConfigsPage'));
const AnnouncementsPage= lazy(() => import('@/pages/announcements/AnnouncementsPage'));
const JobsPage         = lazy(() => import('@/pages/jobs/JobsPage'));
const I18nPage         = lazy(() => import('@/pages/i18n/I18nPage'));

const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
    <Spin size="large" />
  </div>
);

export default function AppRouter() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"       element={<DashboardPage />} />
          <Route
            path="ops-users"
            element={
              <RequirePermission permission={PERMISSIONS.opsUser.read}>
                <OpsUsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="rbac/roles"
            element={
              <RequirePermission permission={PERMISSIONS.rbac.manage}>
                <RolesPage />
              </RequirePermission>
            }
          />
          <Route
            path="rbac/permissions"
            element={
              <RequirePermission permission={PERMISSIONS.rbac.manage}>
                <PermissionsPage />
              </RequirePermission>
            }
          />
          <Route
            path="audit-logs"
            element={
              <RequirePermission permission={PERMISSIONS.audit.read}>
                <AuditLogsPage />
              </RequirePermission>
            }
          />
          <Route
            path="feature-flags"
            element={
              <RequirePermission permission={PERMISSIONS.featureFlag.read}>
                <FeatureFlagsPage />
              </RequirePermission>
            }
          />
          <Route
            path="remote-configs"
            element={
              <RequirePermission permission={PERMISSIONS.remoteConfig.read}>
                <RemoteConfigsPage />
              </RequirePermission>
            }
          />
          <Route
            path="announcements"
            element={
              <RequirePermission permission={PERMISSIONS.announcement.read}>
                <AnnouncementsPage />
              </RequirePermission>
            }
          />
          <Route
            path="i18n"
            element={
              <RequirePermission permission={PERMISSIONS.i18n.read}>
                <I18nPage />
              </RequirePermission>
            }
          />
          <Route
            path="jobs"
            element={
              <RequirePermission permission={PERMISSIONS.job.read}>
                <JobsPage />
              </RequirePermission>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
