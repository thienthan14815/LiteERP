import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import { BusinessError } from "../../common/exceptions/business.exception";
import type { JwtPayload } from "./jwt.strategy";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueTokens(user.id, user.email);
  }

  async refresh(rawToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(rawToken, {
        secret: this.config.get<string>("jwt.refreshSecret") ?? "dev-refresh-secret",
      });
    } catch {
      throw new UnauthorizedException({ code: "INVALID_REFRESH_TOKEN", message: "Invalid refresh token" });
    }
    if (payload.type !== "refresh") {
      throw new UnauthorizedException({ code: "INVALID_TOKEN_TYPE", message: "Refresh token required" });
    }
    const hash = this.hashToken(rawToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: "REFRESH_TOKEN_REVOKED", message: "Refresh token expired or revoked" });
    }
    // Rotate: invalidate the old refresh token and issue a new pair.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({ code: "USER_INACTIVE", message: "User not found or inactive" });
    }
    return this.issueTokens(user.id, user.email);
  }

  async logout(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const hash = this.hashToken(rawToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!record) return;
    if (!record.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: { include: { rolePermissions: { include: { permission: true } } } },
          },
        },
      },
    });
    if (!user) throw new BusinessError("USER_NOT_FOUND", "User not found", 404 as any);
    const roles = user.userRoles.map((ur) => ({ id: ur.role.id, code: ur.role.code, name: ur.role.name }));
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code)),
      ),
    );
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      roles,
      permissions,
    };
  }

  private async issueTokens(userId: string, email: string): Promise<TokenPair> {
    const accessSecret = this.config.get<string>("jwt.accessSecret") ?? "dev-access-secret";
    const refreshSecret = this.config.get<string>("jwt.refreshSecret") ?? "dev-refresh-secret";
    const accessExpiresIn = this.config.get<string>("jwt.accessExpiresIn") ?? "15m";
    const refreshExpiresIn = this.config.get<string>("jwt.refreshExpiresIn") ?? "30d";

    const jti = randomBytes(16).toString("hex");
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, type: "access" } satisfies JwtPayload,
      { secret: accessSecret, expiresIn: accessExpiresIn },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, email, type: "refresh", jti } satisfies JwtPayload & { jti: string },
      { secret: refreshSecret, expiresIn: refreshExpiresIn },
    );

    const expiresAt = this.computeExpiry(refreshExpiresIn);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseDurationSeconds(accessExpiresIn),
    };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private computeExpiry(duration: string): Date {
    const seconds = this.parseDurationSeconds(duration);
    return new Date(Date.now() + seconds * 1000);
  }

  private parseDurationSeconds(s: string): number {
    const m = /^(\d+)([smhdw])$/.exec(s);
    if (!m) return Number(s) || 0;
    const v = Number(m[1]);
    switch (m[2]) {
      case "s": return v;
      case "m": return v * 60;
      case "h": return v * 3600;
      case "d": return v * 86400;
      case "w": return v * 604800;
      default: return v;
    }
  }
}
