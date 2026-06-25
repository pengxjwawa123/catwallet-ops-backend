import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/rbac.dto';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@ApiTags('RBAC - Permissions')
@ApiBearerAuth()
@RequirePermission('rbac:manage')
@Controller('rbac/permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all permissions' })
  findAll() {
    return this.permissionsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get permission by ID' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.permissionsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create permission' })
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.create(dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete permission' })
  @ApiParam({ name: 'id', type: String })
  remove(@Param('id') id: string) {
    return this.permissionsService.remove(id);
  }
}
