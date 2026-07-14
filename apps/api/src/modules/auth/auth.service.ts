import {
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
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

// Per-account brute-force protection. The global per-IP throttle is weak on a
// single-client loopback deployment, so we also lock the account itself.
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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

    // Account currently locked out from too many failed attempts.
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException({
        code: "ACCOUNT_LOCKED",
        message: `Account temporarily locked. Try again in ~${mins} minute(s).`,
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await this.registerFailedAttempt(user.id, user.failedLoginCount ?? 0);
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }

    // Success — clear any accrued failure state and stamp last login.
    await db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
      })
      .where(eq(users.id, user.id));
    return this.issueTokens(user.id, user.email);
  }

  private async registerFailedAttempt(userId: string, current: number): Promise<void> {
    const next = current + 1;
    const locked = next >= MAX_FAILED_ATTEMPTS;
    try {
      await this.dbs.db
        .update(users)
        .set({
          failedLoginCount: locked ? 0 : next,
          lockedUntil: locked ? new Date(Date.now() + LOCK_DURATION_MS) : null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    } catch (err) {
      // Lockout counting is best-effort bookkeeping. If this write fails (e.g.
      // a schema-drifted DB right after a restore), it must NOT escalate a
      // normal wrong-password (401) into a raw 500 — log it and let the caller
      // return the proper "invalid credentials" response.
      this.logger.warn(
        `registerFailedAttempt failed for user ${userId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Change the caller's own password: verify the current one, store the new
   * hash, clear the forced-change flag, and revoke all OTHER sessions so a
   * stolen token can't outlive the rotation.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ changed: true }> {
    if (!newPassword || newPassword.length < 8) {
      throw new BusinessError(
        "WEAK_PASSWORD",
        "New password must be at least 8 characters",
        400 as any,
      );
    }
    const db = this.dbs.db;
    const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    if (!user) throw new BusinessError("USER_NOT_FOUND", "User not found", 404 as any);
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Current password is incorrect",
      });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db
      .update(users)
      .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
      .where(eq(users.id, userId));
    // Invalidate every existing refresh token for this user (logout-all).
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
    return { changed: true };
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
      mustChangePassword: user.mustChangePassword ?? false,
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
