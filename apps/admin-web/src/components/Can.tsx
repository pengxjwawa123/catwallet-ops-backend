import { useAuth } from '@/hooks/useAuth';
import type { PermissionString } from '@/utils/permissions';

/**
 * Element-level permission gate. Renders children only if the user holds the
 * given permission (superadmin always passes). Use to hide write controls
 * (create/edit/delete/publish) that a read-only role must not see.
 *
 *   <Can permission={PERMISSIONS.featureFlag.manage}><Button>Create</Button></Can>
 */
export default function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: PermissionString;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { superAdmin, hasPermission } = useAuth();
  if (superAdmin || hasPermission(permission)) return <>{children}</>;
  return <>{fallback}</>;
}
