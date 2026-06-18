/**
 * E2E: Auth full flow
 * Requires running database + Redis. Skipped automatically if DB is unavailable.
 * Run with: npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as argon2 from 'argon2';

describe('Auth E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let refreshToken: string;
  const testUsername = `e2e_test_${Date.now()}`;
  const testPassword = 'TestP@ss2024!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Seed test superadmin user
    const superadminRole = await prisma.opsRole.upsert({
      where: { name: 'superadmin' },
      update: {},
      create: { name: 'superadmin', description: 'Full access' },
    });

    const passwordHash = await argon2.hash(testPassword);
    const user = await prisma.opsUser.upsert({
      where: { username: testUsername },
      update: {},
      create: { username: testUsername, passwordHash, status: 'ACTIVE' },
    });

    await prisma.opsUserRole.upsert({
      where: { opsUserId_opsRoleId: { opsUserId: user.id, opsRoleId: superadminRole.id } },
      update: {},
      create: { opsUserId: user.id, opsRoleId: superadminRole.id },
    });
  });

  afterAll(async () => {
    await prisma.opsUser.deleteMany({ where: { username: testUsername } });
    await app.close();
  });

  it('POST /auth/login - valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: testUsername, password: testPassword })
      .expect(200);

    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.requires2FA).toBe(false);
    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('POST /auth/login - wrong password returns 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: testUsername, password: 'wrong' })
      .expect(401);
  });

  it('GET /ops-users - protected endpoint requires token', async () => {
    await request(app.getHttpServer()).get('/ops-users').expect(401);
  });

  it('GET /ops-users - accessible with valid token', async () => {
    await request(app.getHttpServer())
      .get('/ops-users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('POST /auth/refresh - rotates tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    refreshToken = res.body.data.refreshToken;
    accessToken = res.body.data.accessToken;
  });

  it('POST /auth/logout - revokes token', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(200);
  });

  it('POST /auth/refresh - revoked token returns 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('POST /ops-users - non-superadmin returns 403', async () => {
    // Create a non-superadmin user
    const normalUsername = `e2e_normal_${Date.now()}`;
    const ph = await argon2.hash(testPassword);
    await prisma.opsUser.create({
      data: { username: normalUsername, passwordHash: ph, status: 'ACTIVE' },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: normalUsername, password: testPassword })
      .expect(200);

    const normalToken = loginRes.body.data.accessToken;

    await request(app.getHttpServer())
      .post('/ops-users')
      .set('Authorization', `Bearer ${normalToken}`)
      .send({ username: 'newuser', password: 'Test@1234!' })
      .expect(403);

    await prisma.opsUser.deleteMany({ where: { username: normalUsername } });
  });
});
