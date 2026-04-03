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

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
