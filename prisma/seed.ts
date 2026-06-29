import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// All permissions to seed
const PERMISSIONS: { resource: string; action: string; description: string }[] = [
  { resource: 'ops_user', action: 'create', description: 'Create ops users' },
  { resource: 'ops_user', action: 'read', description: 'Read ops users' },
  { resource: 'ops_user', action: 'update', description: 'Update ops users' },
  { resource: 'ops_user', action: 'delete', description: 'Delete ops users' },
  { resource: 'rbac', action: 'manage', description: 'Manage roles and permissions' },
  { resource: 'audit', action: 'read', description: 'Read audit logs' },
  { resource: 'role', action: 'assign', description: 'Assign roles to users' },
  { resource: 'feature_flag', action: 'read', description: 'Read feature flags' },
  { resource: 'feature_flag', action: 'manage', description: 'Manage feature flags' },
  { resource: 'remote_config', action: 'read', description: 'Read remote configs' },
  { resource: 'remote_config', action: 'manage', description: 'Manage remote configs' },
  { resource: 'announcement', action: 'read', description: 'Read announcements' },
  { resource: 'announcement', action: 'manage', description: 'Manage announcements' },
  { resource: 'i18n', action: 'read', description: 'Read i18n entries' },
  { resource: 'i18n', action: 'manage', description: 'Manage i18n entries' },
  { resource: 'job', action: 'read', description: 'Read jobs' },
  { resource: 'job', action: 'manage', description: 'Enqueue and manage jobs' },
];

// Permissions granted to operator role (read-only + audit read)
const OPERATOR_PERMISSIONS = new Set([
  'ops_user:read',
  'audit:read',
  'feature_flag:read',
  'remote_config:read',
  'announcement:read',
  'i18n:read',
  'job:read',
]);

async function main() {
  // ── Roles ──────────────────────────────────────────────────────────────────
  const superadminRole = await prisma.opsRole.upsert({
    where: { name: 'superadmin' },
    update: {},
    create: { name: 'superadmin', description: 'Full system access' },
  });

  const operatorRole = await prisma.opsRole.upsert({
    where: { name: 'operator' },
    update: {},
    create: { name: 'operator', description: 'Standard operator access' },
  });

  // ── Permissions ────────────────────────────────────────────────────────────
  const upsertedPerms: { id: string; resource: string; action: string }[] = [];
  for (const p of PERMISSIONS) {
    const perm = await prisma.opsPermission.upsert({
      where: { resource_action: { resource: p.resource, action: p.action } },
      update: { description: p.description },
      create: p,
    });
    upsertedPerms.push(perm);
  }

  // ── Assign all permissions to superadmin ───────────────────────────────────
  for (const perm of upsertedPerms) {
    await prisma.opsRolePermission.upsert({
      where: {
        opsRoleId_opsPermissionId: {
          opsRoleId: superadminRole.id,
          opsPermissionId: perm.id,
        },
      },
      update: {},
      create: { opsRoleId: superadminRole.id, opsPermissionId: perm.id },
    });
  }

  // ── Assign read-only permissions to operator ───────────────────────────────
  for (const perm of upsertedPerms) {
    const key = `${perm.resource}:${perm.action}`;
    if (OPERATOR_PERMISSIONS.has(key)) {
      await prisma.opsRolePermission.upsert({
        where: {
          opsRoleId_opsPermissionId: {
            opsRoleId: operatorRole.id,
            opsPermissionId: perm.id,
          },
        },
        update: {},
        create: { opsRoleId: operatorRole.id, opsPermissionId: perm.id },
      });
    }
  }

  // ── Admin user ─────────────────────────────────────────────────────────────
  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? 'admin';

  if (process.env.NODE_ENV === 'production' && !process.env.SEED_ADMIN_PASSWORD) {
    console.error(
      '[SEED] ERROR: SEED_ADMIN_PASSWORD must be set in production. ' +
        'Refusing to seed with a hardcoded default password.',
    );
    process.exit(1);
  }

  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@CatWallet2024!';

  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn(
      '[SEED] WARNING: Using default superadmin password. ' +
        'Set SEED_ADMIN_PASSWORD env var before first deployment.',
    );
  }

  const passwordHash = await argon2.hash(adminPassword);

  const adminUser = await prisma.opsUser.upsert({
    where: { username: adminUsername },
    update: { passwordHash, status: 'ACTIVE' },
    create: { username: adminUsername, passwordHash, status: 'ACTIVE' },
  });

  await prisma.opsUserRole.upsert({
    where: {
      opsUserId_opsRoleId: { opsUserId: adminUser.id, opsRoleId: superadminRole.id },
    },
    update: {},
    create: { opsUserId: adminUser.id, opsRoleId: superadminRole.id },
  });

  console.log(`[SEED] Superadmin user "${adminUsername}" ready.`);
  console.log('[SEED] Password source: SEED_ADMIN_PASSWORD env var (or default if not set).');
  console.log(`[SEED] Roles created: superadmin, operator`);
  console.log(`[SEED] Permissions seeded: ${upsertedPerms.length}`);
}

main()
  .catch((e) => {
    console.error('[SEED] Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
