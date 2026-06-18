import { IsNotEmpty, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';
import { plainToInstance, Type } from 'class-transformer';

class EnvironmentVariables {
  @IsNotEmpty()
  @IsString()
  DATABASE_URL: string;

  @IsNotEmpty()
  @IsString()
  REDIS_URL: string;

  @IsNotEmpty()
  @IsString()
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_EXPIRY?: string = '15m';

  @IsOptional()
  @IsString()
  JWT_REFRESH_EXPIRY?: string = '7d';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  PORT?: number = 3000;

  @IsOptional()
  @IsString()
  NODE_ENV?: string = 'development';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Config validation failed:\n${errors.toString()}`);
  }
  return validatedConfig;
}
