import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppEnv } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get('ConfigService') as {
    get<K extends keyof AppEnv>(key: K, options?: { infer: true }): AppEnv[K];
  };
  const port = config.get('PORT', { infer: true });
  const origins = config
    .get('APP_ORIGINS', { infer: true })
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({
    origin: origins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(port);
}

bootstrap();
