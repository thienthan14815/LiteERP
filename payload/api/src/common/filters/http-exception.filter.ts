import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

// Standard error shape per ARCHITECTURE.md section 18:
//   { success: false, error: { code, message, details } }
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_SERVER_ERROR";
    let message = "Internal server error";
    let details: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === "string") {
        message = res;
        code = this.codeFromStatus(status);
      } else if (typeof res === "object" && res !== null) {
        const obj = res as Record<string, unknown>;
        message = (obj.message as string) ?? exception.message;
        code = (obj.code as string) ?? this.codeFromStatus(status);
        if (obj.details && typeof obj.details === "object") {
          details = obj.details as Record<string, unknown>;
        }
        if (Array.isArray(obj.message)) {
          details.errors = obj.message;
          message = "Validation failed";
          code = "VALIDATION_ERROR";
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.stack);
    } else {
      this.logger.error(`Unknown exception: ${JSON.stringify(exception)}`);
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        details,
      },
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private codeFromStatus(status: number): string {
    switch (status) {
      case 400: return "BAD_REQUEST";
      case 401: return "UNAUTHORIZED";
      case 403: return "FORBIDDEN";
      case 404: return "NOT_FOUND";
      case 409: return "CONFLICT";
      case 422: return "VALIDATION_ERROR";
      default:  return "INTERNAL_SERVER_ERROR";
    }
  }
}
