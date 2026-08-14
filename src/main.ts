import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilita CORS para permitir que requisições do App (Flutter) e Web (Next.js) passem sem bloqueios
  app.enableCors();

  // Garante que os DTOs validem automaticamente os campos recebidos no body da requisição
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Configuração da Documentação Interativa do Swagger
  const config = new DocumentBuilder()
    .setTitle('Beach Social Club - API')
    .setDescription(
      'API B2B2C para Gestão de Arenas, Vagas ForFun, Elo e Comunidade Esportiva',
    )
    .setVersion('1.0')
    .addBearerAuth() // Habilita o campo de envio de Token JWT no Swagger
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`🚀 Beach Social Club API rodando em http://localhost:${port}`);
  console.log(`📄 Swagger disponível em http://localhost:${port}/api/docs`);
}
bootstrap();