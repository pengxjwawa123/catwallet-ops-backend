import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  // Create superadmin role
  const superadminRole = await prisma.opsRole.upsert({
    where: { name: 'superadmin' },
    update: {},
    create: {
      name: 'superadmin',
      description: 'Full system access',
    },
  });

  // Create operator role
  await prisma.opsRole.upsert({
    where: { name: 'operator' },
    update: {},
    create: {
      name: 'operator',
      description: 'Standard operator access',
    },
  });

  // Determine superadmin credentials from env or defaults
  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? 'admin';

  // LOW#9: Reject hardcoded default password in production to prevent insecure deployments
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
    update: {},
    create: {
      username: adminUsername,
      passwordHash,
      status: 'ACTIVE',
    },
  });

  // Assign superadmin role to admin user
  await prisma.opsUserRole.upsert({
    where: {
      opsUserId_opsRoleId: {
        opsUserId: adminUser.id,
        opsRoleId: superadminRole.id,
      },
    },
    update: {},
    create: {
      opsUserId: adminUser.id,
      opsRoleId: superadminRole.id,
    },
  });

  console.log(`[SEED] Superadmin user "${adminUsername}" ready.`);
  console.log('[SEED] Password source: SEED_ADMIN_PASSWORD env var (or default if not set).');
  console.log('[SEED] Roles created: superadmin, operator');
}

main()
  .catch((e) => {
    console.error('[SEED] Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
