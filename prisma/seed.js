"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const argon2 = require("argon2");
const prisma = new client_1.PrismaClient();
async function main() {
    const superadminRole = await prisma.opsRole.upsert({
        where: { name: 'superadmin' },
        update: {},
        create: {
            name: 'superadmin',
            description: 'Full system access',
        },
    });
    await prisma.opsRole.upsert({
        where: { name: 'operator' },
        update: {},
        create: {
            name: 'operator',
            description: 'Standard operator access',
        },
    });
    const adminUsername = process.env.SEED_ADMIN_USERNAME ?? 'admin';
    if (process.env.NODE_ENV === 'production' && !process.env.SEED_ADMIN_PASSWORD) {
        console.error('[SEED] ERROR: SEED_ADMIN_PASSWORD must be set in production. ' +
            'Refusing to seed with a hardcoded default password.');
        process.exit(1);
    }
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@CatWallet2024!';
    if (!process.env.SEED_ADMIN_PASSWORD) {
        console.warn('[SEED] WARNING: Using default superadmin password. ' +
            'Set SEED_ADMIN_PASSWORD env var before first deployment.');
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
//# sourceMappingURL=seed.js.map