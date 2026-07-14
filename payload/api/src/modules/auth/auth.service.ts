import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { DbService } from "../../database/db.service";
import { refreshTokens, users } from "../../database/schema";
import { createId } from "../../database/id";
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
    private readonly dbs: DbService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<TokenPair> {
    const db = this.dbs.db;
    const user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));
    return this.issueTokens(user.id, user.email);
  }

  async refresh(rawToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(rawToken, {
        secret: this.requireSecret("jwt.refreshSecret"),
      });
    } catch {
      throw new UnauthorizedException({ code: "INVALID_REFRESH_TOKEN", message: "Invalid refresh token" });
    }
    if (payload.type !== "refresh") {
      throw new UnauthorizedException({ code: "INVALID_TOKEN_TYPE", message: "Refresh token required" });
    }
    const db = this.dbs.db;
    const hash = this.hashToken(rawToken);
    const record = (
      await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, hash)).limit(1)
    )[0];
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: "REFRESH_TOKEN_REVOKED", message: "Refresh token expired or revoked" });
    }
    // Rotate: invalidate the old refresh token and issue a new pair.
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, record.id));
    const user = (await db.select().from(users).where(eq(users.id, payload.sub)).limit(1))[0];
    if (!user || !user.isActive) {
      throw new UnauthorizedException({ code: "USER_INACTIVE", message: "User not found or inactive" });
    }
    return this.issueTokens(user.id, user.email);
  }

  async logout(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const db = this.dbs.db;
    const hash = this.hashToken(rawToken);
    const record = (
      await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, hash)).limit(1)
    )[0];
    if (!record) return;
    if (!record.revokedAt) {
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, record.id));
    }
  }

  async me(userId: string) {
    const user = await this.dbs.db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        userRoles: {
          with: {
            role: { with: { rolePermissions: { with: { permission: true } } } },
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

  private requireSecret(key: "jwt.accessSecret" | "jwt.refreshSecret"): string {
    const value = this.config.get<string>(key);
    if (!value || value.length < 32) {
      throw new Error(
        `[auth] ${key} is not configured or too short (<32 chars). Set JWT_ACCESS_SECRET / JWT_REFRESH_SECRET env.`,
      );
    }
    return value;
  }

  private async issueTokens(userId: string, email: string): Promise<TokenPair> {
    const accessSecret = this.requireSecret("jwt.accessSecret");
    const refreshSecret = this.requireSecret("jwt.refreshSecret");
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
    await this.dbs.db.insert(refreshTokens).values({
      id: createId(),
      userId,
      tokenHash: this.hashToken(refreshToken),
      expiresAt,
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
