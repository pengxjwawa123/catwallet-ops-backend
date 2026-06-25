import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionDto, AssignRoleDto } from './dto/rbac.dto';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';

@ApiTags('RBAC - Roles')
@ApiBearerAuth()
@RequirePermission('rbac:manage')
@Controller('rbac/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'List all roles' })
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get role by ID' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create role' })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update role description' })
  @ApiParam({ name: 'id', type: String })
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete role' })
  @ApiParam({ name: 'id', type: String })
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }

  @Post(':id/permissions')
  @ApiOperation({ summary: 'Assign permission to role' })
  @ApiParam({ name: 'id', type: String })
  assignPermission(
    @Param('id') id: string,
    @Body() dto: AssignPermissionDto,
    @CurrentUser() caller: RequestUser,
  ) {
    return this.rolesService.assignPermission(id, dto, caller);
  }

  @Delete(':id/permissions/:permissionId')
  @ApiOperation({ summary: 'Remove permission from role' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'permissionId', type: String })
  removePermission(@Param('id') id: string, @Param('permissionId') permissionId: string) {
    return this.rolesService.removePermission(id, permissionId);
  }

  @Post('users/:userId/assign')
  @ApiOperation({ summary: 'Assign role to user' })
  @ApiParam({ name: 'userId', type: String })
  assignRoleToUser(
    @Param('userId') userId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() caller: RequestUser,
  ) {
    return this.rolesService.assignRoleToUser(userId, dto, caller);
  }

  @Delete('users/:userId/roles/:roleId')
  @ApiOperation({ summary: 'Remove role from user' })
  @ApiParam({ name: 'userId', type: String })
  @ApiParam({ name: 'roleId', type: String })
  removeRoleFromUser(@Param('userId') userId: string, @Param('roleId') roleId: string) {
    return this.rolesService.removeRoleFromUser(userId, roleId);
  }
}
