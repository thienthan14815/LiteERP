import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  userId?: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class RequestContextService {
  private readonly als = new AsyncLocalStorage<RequestContext>();

  run<T>(ctx: RequestContext, fn: () => T): T {
    return this.als.run(ctx, fn);
  }

  get(): RequestContext | undefined {
    return this.als.getStore();
  }

  getUserId(): string | undefined {
    return this.als.getStore()?.userId;
  }

  getIp(): string | undefined {
    return this.als.getStore()?.ip;
  }

  getUserAgent(): string | undefined {
    return this.als.getStore()?.userAgent;
  }
}
