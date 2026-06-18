import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { OpsUsersService } from './ops-users.service';
import {
  CreateOpsUserDto,
  UpdateOpsUserDto,
  ResetPasswordDto,
  SetStatusDto,
} from './dto/ops-user.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@ApiTags('Ops Users')
@ApiBearerAuth()
@Controller('ops-users')
export class OpsUsersController {
  constructor(private readonly opsUsersService: OpsUsersService) {}

  @Post()
  @RequirePermission('ops_user:create')
  @ApiOperation({ summary: 'Create ops user' })
  create(@Body() dto: CreateOpsUserDto, @CurrentUser() caller: RequestUser) {
    return this.opsUsersService.create(dto, caller);
  }

  @Get()
  @RequirePermission('ops_user:read')
  @ApiOperation({ summary: 'List ops users with pagination' })
  findAll(@Query() pagination: PaginationDto) {
    return this.opsUsersService.findAll(pagination);
  }

  @Get(':id')
  @RequirePermission('ops_user:read')
  @ApiOperation({ summary: 'Get ops user by ID' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.opsUsersService.findOne(id);
  }

  @Put(':id')
  @RequirePermission('ops_user:update')
  @ApiOperation({ summary: 'Update ops user' })
  @ApiParam({ name: 'id', type: String })
  update(@Param('id') id: string, @Body() dto: UpdateOpsUserDto, @CurrentUser() caller: RequestUser) {
    return this.opsUsersService.update(id, dto, caller);
  }

  @Patch(':id/password')
  @RequirePermission('ops_user:update')
  @ApiOperation({ summary: 'Reset user password' })
  @ApiParam({ name: 'id', type: String })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() caller: RequestUser,
  ) {
    return this.opsUsersService.resetPassword(id, dto, caller);
  }

  @Patch(':id/status')
  @RequirePermission('ops_user:update')
  @ApiOperation({ summary: 'Set user status' })
  @ApiParam({ name: 'id', type: String })
  setStatus(
    @Param('id') id: string,
    @Body() dto: SetStatusDto,
    @CurrentUser() caller: RequestUser,
  ) {
    return this.opsUsersService.setStatus(id, dto, caller);
  }

  @Delete(':id')
  @RequirePermission('ops_user:delete')
  @ApiOperation({ summary: 'Delete ops user' })
  @ApiParam({ name: 'id', type: String })
  remove(@Param('id') id: string, @CurrentUser() caller: RequestUser) {
    return this.opsUsersService.remove(id, caller);
  }
}
