import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class Enable2FADto {
  @ApiProperty({ description: '6-digit TOTP code', example: '123456' })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  token: string;
}

export class Verify2FADto {
  @ApiProperty({ description: 'User ID returned from login step 1' })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({ description: '6-digit TOTP code', example: '123456' })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  token: string;
}
