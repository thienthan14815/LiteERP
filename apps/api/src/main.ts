import "./bootstrap/intl-shim";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Request, Response, NextFunction } from "express";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["error", "warn", "log"],
  });
  const logger = new Logger("Bootstrap");

  // Cap JSON/urlencoded body size (multipart uploads are bounded separately by
  // multer limits in the attachments/backup modules).
  app.useBodyParser("json", { limit: "1mb" });
  app.useBodyParser("urlencoded", { limit: "1mb", extended: true });

  const expressApp = app.getHttpAdapter().getInstance();

  // Correlation id + minimal access log. Registered FIRST so every request —
  // including ones rejected in a guard before Nest interceptors run — carries
  // an id that appears in the response (X-Request-Id) and server logs.
  expressApp.use((req: Request & { requestId?: string }, res: Response, next: NextFunction) => {
    const incoming = (req.headers["x-request-id"] as string | undefined)?.slice(0, 100);
    const id = incoming || randomUUID();
    req.requestId = id;
    res.setHeader("X-Request-Id", id);
    const start = Date.now();
    res.on("finish", () => {
      if (req.path.startsWith("/api/")) {
        logger.log(
          `[${id}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`,
        );
      }
    });
    next();
  });

  // CSP scoped for the on-device WebView: same-origin + inline (the Next static
  // export boots via inline scripts), Drive image/preview hosts allow-listed,
  // everything else blocked. Stricter than the previous `csp: false`.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "script-src": ["'self'", "'unsafe-inline'"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "img-src": [
            "'self'",
            "data:",
            "blob:",
            "https://drive.google.com",
            "https://*.googleusercontent.com",
          ],
          "connect-src": ["'self'"],
          "frame-src": ["'self'", "https://drive.google.com"],
          "object-src": ["'none'"],
          "base-uri": ["'self'"],
          // Loopback serves plain HTTP — do NOT force an https upgrade.
          "upgrade-insecure-requests": null,
        },
      },
    }),
  );

  // CORS: explicit allow-list only. Never reflect an arbitrary origin together
  // with credentials. Same-origin (WebView → loopback) needs no entry here.
  const corsOrigins = process.env.APP_URL?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins && corsOrigins.length ? corsOrigins : false,
    credentials: true,
  });

  // Static frontend — registered BEFORE setGlobalPrefix + route mount so the
  // middleware sits ahead of Nest's `/api/v1` router on the express stack.
  // WEB_DIR overrides `../web/out`. Nuance for Next `output: "export"`:
  //   - `/login.html` served directly by static.
  //   - `/login` (no ext) → we rewrite req.url to `/login.html` if the file
  //     exists on disk, then static serves it.
  //   - Anything else (unknown SPA client-side route) → fall back to
  //     `/index.html` so client-side routing continues to work.
  // API prefix `/api/v1/*` is set below; requests to that path are excluded
  // from the rewrite by the leading-guard check.
  const webDir = resolve(process.env.WEB_DIR ?? "../web/out");
  if (existsSync(webDir)) {
    expressApp.use((req: any, _res: any, next: any) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      if (req.path.startsWith("/api/")) return next();
      // Requests already carrying an extension (JS/CSS/images) go straight
      // to static.
      if (/\.[a-zA-Z0-9]+$/.test(req.path)) return next();
      const trimmed = req.path.replace(/^\//, "").replace(/\/$/, "");
      const htmlName = trimmed ? `${trimmed}.html` : "index.html";
      const candidate = join(webDir, htmlName);
      try {
        if (existsSync(candidate) && statSync(candidate).isFile()) {
          // Rewrite so downstream express.static serves the .html file.
          const query = req.url.includes("?")
            ? req.url.slice(req.url.indexOf("?"))
            : "";
          req.url = "/" + htmlName + query;
          return next();
        }
      } catch {
        /* fall through */
      }
      // SPA fallback: unknown route → index.html.
      req.url = "/index.html";
      return next();
    });
    app.useStaticAssets(webDir, { index: ["index.html"] });
    logger.log(`Serving static frontend from ${webDir}`);
  } else {
    logger.warn(
      `WEB_DIR ${webDir} does not exist — API only. Build frontend with 'pnpm --filter @app/web build'.`,
    );
  }

  app.setGlobalPrefix("api/v1");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // API docs. On by default outside production; opt-in in production via
  // SWAGGER_ENABLED=1 (kept off there since the app ships on-device).
  const swaggerEnabled =
    process.env.NODE_ENV !== "production" || process.env.SWAGGER_ENABLED === "1";
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("LiteERP API")
      .setDescription("On-device ERP API (NestJS + SQLite)")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/v1/docs", app, document);
    logger.log("Swagger UI available at /api/v1/docs");
  }

  // Fire OnModuleDestroy on SIGTERM/SIGINT → DbService drains + checkpoints WAL.
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  const server = await app.listen(port);

  // Socket hygiene: bound how long a client may hold a connection while sending
  // headers / keeping it alive. requestTimeout stays generous so large restore
  // uploads (up to ~200 MB) complete.
  server.headersTimeout = 60_000;
  server.keepAliveTimeout = 65_000;
  server.requestTimeout = 120_000;

  logger.log(`API listening on http://localhost:${port}/api/v1`);
}

bootstrap();
