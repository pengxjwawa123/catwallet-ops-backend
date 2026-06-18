import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'operator' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class AssignPermissionDto {
  @ApiProperty({ example: 'perm-cuid-here' })
  @IsString()
  permissionId: string;
}

export class AssignRoleDto {
  @ApiProperty({ example: 'role-cuid-here' })
  @IsString()
  roleId: string;
}

export class CreatePermissionDto {
  @ApiProperty({ example: 'ops_user' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  resource: string;

  @ApiProperty({ example: 'create' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  action: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
