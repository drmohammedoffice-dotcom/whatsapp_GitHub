import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { FriendlyErrorsFilter } from './common/filters/friendly-errors.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  const config = app.get(ConfigService);
  const origins = config.getOrThrow<string>('CORS_ORIGINS').split(',').map((origin) => origin.trim());
  const isProd = config.get<string>('NODE_ENV') === 'production';

  const http = app.getHttpAdapter().getInstance() as { set: (k: string, v: unknown) => void };
  http.set('trust proxy', 1);

  app.use(requestIdMiddleware);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hidePoweredBy: true,
      frameguard: { action: 'sameorigin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: isProd ? { maxAge: 15_552_000, includeSubDomains: true } : false,
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new FriendlyErrorsFilter(app.get(HttpAdapterHost).httpAdapter));
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'api/auth/tiktok/login', method: RequestMethod.GET },
      { path: 'api/auth/tiktok/login', method: RequestMethod.POST },
      { path: 'api/auth/tiktok/callback', method: RequestMethod.GET },
      { path: 'api/auth/tiktok-business/login', method: RequestMethod.POST },
      { path: 'api/auth/tiktok-business/callback', method: RequestMethod.GET },
      { path: 'api/webhooks/meta', method: RequestMethod.GET },
      { path: 'api/webhooks/meta', method: RequestMethod.POST },
      { path: 'api/auth/meta/login', method: RequestMethod.POST },
      { path: 'api/auth/meta/callback', method: RequestMethod.GET },
      { path: 'api/meta/sdk-config', method: RequestMethod.GET },
      { path: 'r/(.*)', method: RequestMethod.GET },
      { path: 't/t/(.*)', method: RequestMethod.GET },
      { path: 'api/tiktok-integration/(.*)', method: RequestMethod.ALL },
      { path: 'api/tiktok-business/(.*)', method: RequestMethod.ALL },
    ],
  });

  const swaggerEnabled = config.get<string>('ENABLE_SWAGGER') === 'true' || !isProd;
  if (swaggerEnabled) {
    const swagger = new DocumentBuilder()
      .setTitle('WhatsApp SaaS API')
      .setDescription('Multi-tenant WhatsApp REST API backed by Baileys')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));
  }

  const port = Number(process.env.PORT) || config.get<number>('API_PORT', 4000);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
