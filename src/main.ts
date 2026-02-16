import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // ✅ Izinkan origin dari frontend production
  app.enableCors({
    origin: [
      'https://satuundangan.id',
      'https://www.satuundangan.id',
      'https://api.satuundangan.id',
      'http://localhost:5173', // untuk development
      'http://localhost:5174', // untuk testing API langsung
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // penting kalau pakai cookie atau header auth
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

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
