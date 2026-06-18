import { IsNotEmpty, IsNumber, IsOptional, IsString, MinLength, validateSync } from 'class-validator';
import { plainToInstance, Type } from 'class-transformer';

const KNOWN_WEAK_SECRETS = ['change-me-to-a-long-random-secret'];

class EnvironmentVariables {
  @IsNotEmpty()
  @IsString()
  DATABASE_URL: string;

  @IsNotEmpty()
  @IsString()
  REDIS_URL: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
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

  if (KNOWN_WEAK_SECRETS.includes(validatedConfig.JWT_SECRET)) {
    throw new Error(
      'Config validation failed: JWT_SECRET is a known placeholder value. ' +
        'Set a strong random secret before starting the application.',
    );
  }

  return validatedConfig;
}
