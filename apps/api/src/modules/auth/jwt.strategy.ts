import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { eq } from "drizzle-orm";
import { DbService } from "../../database/db.service";
import { users } from "../../database/schema";
import type { AuthUser } from "../../common/decorators/current-user.decorator";

export interface JwtPayload {
  sub: string;
  email: string;
  type: "access" | "refresh";
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(config: ConfigService, private readonly dbs: DbService) {
    // Fail closed: verify side must use the SAME 32-char-minimum secret the
    // signing side enforces (AuthService.requireSecret). No dev fallback — a
    // misconfigured/empty secret would let forged tokens through.
    const accessSecret = config.get<string>("jwt.accessSecret");
    if (!accessSecret || accessSecret.length < 32) {
      throw new Error(
        "[auth] JWT_ACCESS_SECRET is not configured or too short (<32 chars). Set it in your .env and restart.",
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.type !== "access") {
      throw new UnauthorizedException({ code: "INVALID_TOKEN_TYPE", message: "Access token required" });
    }
    const user = await this.dbs.db.query.users.findFirst({
      where: eq(users.id, payload.sub),
      with: {
        userRoles: {
          with: {
            role: { with: { rolePermissions: { with: { permission: true } } } },
          },
        },
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({ code: "USER_INACTIVE", message: "User not found or inactive" });
    }
    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code)),
      ),
    );
    return { id: user.id, email: user.email, roles, permissions };
  }
}
