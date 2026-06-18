import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use pino logger
  app.useLogger(app.get(Logger));

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Global filters & interceptors
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // CORS — bearer-token API; credentials:true + wildcard is forbidden by browsers.
  // In production, require an explicit CORS_ORIGIN. In dev, allow all for convenience.
  const isProduction = process.env.NODE_ENV === 'production';
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: isProduction ? (corsOrigin ?? false) : (corsOrigin ?? '*'),
    credentials: false, // bearer-token API does not need cookie credentials
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('CatWallet Ops API')
    .setDescription('CatWallet operations backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = parseInt(process.env.PORT ?? '3000', 10);
  // 显式绑定 0.0.0.0,确保容器内端口映射可从宿主机访问
  await app.listen(port, '0.0.0.0');
  const logger = app.get(Logger);
  logger.log(`Application listening on port ${port}`, 'Bootstrap');
  logger.log(`Swagger docs available at http://localhost:${port}/docs`, 'Bootstrap');
}

bootstrap();
