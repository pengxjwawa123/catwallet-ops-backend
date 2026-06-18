import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  AnnouncementQueryDto,
} from './dto/announcement.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@ApiTags('Announcements')
@ApiBearerAuth()
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  @RequirePermission('announcement:manage')
  @ApiOperation({ summary: 'Create announcement' })
  create(@Body() dto: CreateAnnouncementDto) {
    return this.announcementsService.create(dto);
  }

  @Get()
  @RequirePermission('announcement:read')
  @ApiOperation({ summary: 'List announcements (filterable by status) with pagination' })
  findAll(@Query() query: AnnouncementQueryDto & PaginationDto) {
    return this.announcementsService.findAll(query);
  }

  @Get(':id')
  @RequirePermission('announcement:read')
  @ApiOperation({ summary: 'Get announcement by ID' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.announcementsService.findOne(id);
  }

  @Put(':id')
  @RequirePermission('announcement:manage')
  @ApiOperation({ summary: 'Update announcement' })
  @ApiParam({ name: 'id', type: String })
  update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.announcementsService.update(id, dto);
  }

  @Patch(':id/publish')
  @RequirePermission('announcement:manage')
  @ApiOperation({ summary: 'Publish announcement (DRAFT → PUBLISHED)' })
  @ApiParam({ name: 'id', type: String })
  publish(@Param('id') id: string) {
    return this.announcementsService.publish(id);
  }

  @Patch(':id/unpublish')
  @RequirePermission('announcement:manage')
  @ApiOperation({ summary: 'Unpublish announcement (PUBLISHED → DRAFT)' })
  @ApiParam({ name: 'id', type: String })
  unpublish(@Param('id') id: string) {
    return this.announcementsService.unpublish(id);
  }

  @Patch(':id/archive')
  @RequirePermission('announcement:manage')
  @ApiOperation({ summary: 'Archive announcement' })
  @ApiParam({ name: 'id', type: String })
  archive(@Param('id') id: string) {
    return this.announcementsService.archive(id);
  }

  @Delete(':id')
  @RequirePermission('announcement:manage')
  @ApiOperation({ summary: 'Delete announcement' })
  @ApiParam({ name: 'id', type: String })
  remove(@Param('id') id: string) {
    return this.announcementsService.remove(id);
  }
}
