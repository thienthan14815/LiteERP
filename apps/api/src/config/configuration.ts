export interface AppConfig {
  nodeEnv: string;
  port: number;
  appUrl: string;
  apiUrl: string;
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  s3: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  };
}

export const typedConfig = (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  apiUrl: process.env.API_URL ?? "http://localhost:3000",
  database: {
    url: process.env.DATABASE_URL ?? "",
  },
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? "",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "",
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? "",
    region: process.env.S3_REGION ?? "us-east-1",
    bucket: process.env.S3_BUCKET ?? "",
    accessKey: process.env.S3_ACCESS_KEY ?? "",
    secretKey: process.env.S3_SECRET_KEY ?? "",
  },
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? "",
  },
});
