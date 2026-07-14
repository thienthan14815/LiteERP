import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { RequestContextService } from "../context/request-context.service";
import type { AuthUser } from "../decorators/current-user.decorator";

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly ctx: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    const store = {
      userId: user?.id,
      ip: (req.ip as string | undefined) ?? (req.headers["x-forwarded-for"] as string | undefined),
      userAgent: req.headers["user-agent"] as string | undefined,
      // Set by the request-id middleware in main.ts (present even for errors
      // thrown before this interceptor runs).
      requestId: req.requestId as string | undefined,
    };
    return new Observable((subscriber) => {
      this.ctx.run(store, () => {
        next.handle().subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
