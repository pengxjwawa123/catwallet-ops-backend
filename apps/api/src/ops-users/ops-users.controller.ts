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

@ApiTags('Ops Users')
@ApiBearerAuth()
@Controller('ops-users')
export class OpsUsersController {
  constructor(private readonly opsUsersService: OpsUsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create ops user (superadmin only)' })
  create(@Body() dto: CreateOpsUserDto, @CurrentUser() caller: RequestUser) {
    return this.opsUsersService.create(dto, caller);
  }

  @Get()
  @ApiOperation({ summary: 'List ops users with pagination' })
  findAll(@Query() pagination: PaginationDto) {
    return this.opsUsersService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ops user by ID' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.opsUsersService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update ops user' })
  @ApiParam({ name: 'id', type: String })
  update(@Param('id') id: string, @Body() dto: UpdateOpsUserDto, @CurrentUser() caller: RequestUser) {
    return this.opsUsersService.update(id, dto, caller);
  }

  @Patch(':id/password')
  @ApiOperation({ summary: 'Reset user password (superadmin only)' })
  @ApiParam({ name: 'id', type: String })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() caller: RequestUser,
  ) {
    return this.opsUsersService.resetPassword(id, dto, caller);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Set user status (superadmin only)' })
  @ApiParam({ name: 'id', type: String })
  setStatus(
    @Param('id') id: string,
    @Body() dto: SetStatusDto,
    @CurrentUser() caller: RequestUser,
  ) {
    return this.opsUsersService.setStatus(id, dto, caller);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete ops user (superadmin only)' })
  @ApiParam({ name: 'id', type: String })
  remove(@Param('id') id: string, @CurrentUser() caller: RequestUser) {
    return this.opsUsersService.remove(id, caller);
  }
}
