import "./bootstrap/intl-shim";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["error", "warn", "log"],
  });

  app.use(helmet());

  app.enableCors({
    origin: process.env.APP_URL?.split(",") ?? true,
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
    const expressApp = app.getHttpAdapter().getInstance();
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
    Logger.log(`Serving static frontend from ${webDir}`, "Bootstrap");
  } else {
    Logger.warn(
      `WEB_DIR ${webDir} does not exist — API only. Build frontend with 'pnpm --filter @app/web build'.`,
      "Bootstrap",
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

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/api/v1`, "Bootstrap");
}

bootstrap();
