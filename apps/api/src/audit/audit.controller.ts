import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermission('audit:read')
  @ApiOperation({ summary: 'List audit logs with pagination and filters' })
  findAll(@Query() query: AuditLogQueryDto) {
    return this.auditService.findAll(query);
  }
}
