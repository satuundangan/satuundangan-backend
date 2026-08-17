import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded, static as expressStatic } from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.enableCors({
    origin: [
      'https://satuundangan.id',
      'https://www.satuundangan.id',
      'https://api.satuundangan.id',
      'http://localhost:5173', // untuk development
      'http://127.0.0.1:5173', // untuk development IPv4
      'http://[::1]:5173', // untuk development IPv6
      'http://localhost:5174', // untuk testing API langsung
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204,
  });

  // Swagger config
  const config = new DocumentBuilder()
    .setTitle('Undangan Online API')
    .setDescription('API dokumentasi untuk sistem undangan online ✨')
    .setVersion('1.0')
    .addBearerAuth() // Untuk JWT Authorization
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // Serve local uploads when R2 is not configured (dev fallback)
  app.use('/uploads', expressStatic(join(process.cwd(), 'uploads')));

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
