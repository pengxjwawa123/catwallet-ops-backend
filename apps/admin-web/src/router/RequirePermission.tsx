import { Spin } from 'antd';
import { useAuth } from '@/hooks/useAuth';
import ForbiddenPage from '@/pages/ForbiddenPage';
import type { PermissionString } from '@/utils/permissions';

/**
 * Route-level permission gate. Renders children only if the user holds the
 * required permission (superadmin always passes). While the effective
 * permission set is still loading from /auth/me, it blocks with a spinner so
 * the check is never evaluated against an empty set (avoids both a false 403
 * and a flash of forbidden content on deep-link/refresh).
 */
export default function RequirePermission({
  permission,
  children,
}: {
  permission: PermissionString;
  children: React.ReactNode;
}) {
  const { superAdmin, hasPermission, permissionsLoaded } = useAuth();

  if (superAdmin) return <>{children}</>;

  if (!permissionsLoaded) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!hasPermission(permission)) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}
