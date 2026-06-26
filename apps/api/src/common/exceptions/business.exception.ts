import { HttpException, HttpStatus } from "@nestjs/common";

export class BusinessError extends HttpException {
  constructor(
    code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, unknown>,
  ) {
    super({ code, message, details: details ?? {} }, status);
  }
}
