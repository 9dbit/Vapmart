import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type {NestExpressApplication} from '@nestjs/platform-express';
import { AppModule } from './module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, rawBody: true });
  app.useBodyParser('json',{limit:'3mb'});
  app.enableCors({
    origin: process.env.WEB_ORIGIN ? process.env.WEB_ORIGIN.split(',').map(s => s.trim()) : false,
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 4000), '0.0.0.0');
}
bootstrap().catch(error => {
  console.error('API startup failed', error);
  process.exitCode = 1;
});
