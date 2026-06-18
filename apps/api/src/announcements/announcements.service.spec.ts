import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnnouncementStatus } from '@prisma/client';

const mockPrisma = {
  announcement: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<AnnouncementsService>(AnnouncementsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates an announcement with DRAFT status', async () => {
      mockPrisma.announcement.create.mockResolvedValue({
        id: 'a1', title: 'Test', content: 'Body', status: AnnouncementStatus.DRAFT,
      });
      const result = await service.create({ title: 'Test', content: 'Body' });
      expect(result.status).toBe(AnnouncementStatus.DRAFT);
    });
  });

  describe('findAll', () => {
    it('returns paginated results filtered by status', async () => {
      mockPrisma.announcement.findMany.mockResolvedValue([]);
      mockPrisma.announcement.count.mockResolvedValue(0);
      const result = await service.findAll({ status: AnnouncementStatus.PUBLISHED, page: 1, pageSize: 10 });
      expect(result).toHaveProperty('items');
      expect(mockPrisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: AnnouncementStatus.PUBLISHED } }),
      );
    });
  });

  describe('publish', () => {
    it('transitions DRAFT → PUBLISHED and sets publishedAt', async () => {
      const draft = { id: 'a1', status: AnnouncementStatus.DRAFT, publishedAt: null };
      mockPrisma.announcement.findUnique.mockResolvedValue(draft);
      mockPrisma.announcement.update.mockResolvedValue({
        ...draft,
        status: AnnouncementStatus.PUBLISHED,
        publishedAt: new Date(),
      });
      const result = await service.publish('a1');
      expect(result.status).toBe(AnnouncementStatus.PUBLISHED);
      expect(mockPrisma.announcement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: AnnouncementStatus.PUBLISHED }),
        }),
      );
    });

    it('throws BadRequestException when already published', async () => {
      mockPrisma.announcement.findUnique.mockResolvedValue({
        id: 'a1', status: AnnouncementStatus.PUBLISHED,
      });
      await expect(service.publish('a1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.announcement.findUnique.mockResolvedValue(null);
      await expect(service.publish('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('unpublish', () => {
    it('transitions PUBLISHED → DRAFT', async () => {
      mockPrisma.announcement.findUnique.mockResolvedValue({
        id: 'a1', status: AnnouncementStatus.PUBLISHED,
      });
      mockPrisma.announcement.update.mockResolvedValue({
        id: 'a1', status: AnnouncementStatus.DRAFT,
      });
      const result = await service.unpublish('a1');
      expect(result.status).toBe(AnnouncementStatus.DRAFT);
    });

    it('throws BadRequestException when not published', async () => {
      mockPrisma.announcement.findUnique.mockResolvedValue({
        id: 'a1', status: AnnouncementStatus.DRAFT,
      });
      await expect(service.unpublish('a1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('deletes announcement', async () => {
      mockPrisma.announcement.findUnique.mockResolvedValue({ id: 'a1' });
      mockPrisma.announcement.delete.mockResolvedValue({});
      const result = await service.remove('a1');
      expect(result).toEqual({ success: true });
    });
  });
});
