import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../database/prisma.service";
import type { AuthUser } from "../../common/decorators/current-user.decorator";

export interface JwtPayload {
  sub: string;
  email: string;
  type: "access" | "refresh";
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("jwt.accessSecret") ?? "dev-access-secret",
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.type !== "access") {
      throw new UnauthorizedException({ code: "INVALID_TOKEN_TYPE", message: "Access token required" });
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
          include: {
            role: { include: { rolePermissions: { include: { permission: true } } } },
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
