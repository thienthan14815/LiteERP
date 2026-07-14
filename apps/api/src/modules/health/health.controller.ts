import { Controller, Get } from "@nestjs/common";
import { DbService } from "../../database/db.service";
import { DriveService } from "../drive/drive.service";
import { Public } from "../../common/decorators/public.decorator";

@Controller("health")
export class HealthController {
  constructor(
    private readonly dbs: DbService,
    private readonly drive: DriveService,
  ) {}

  @Public()
  @Get()
  async health() {
    let db: "up" | "down" = "down";
    try {
      await this.dbs.queryRaw("SELECT 1");
      db = "up";
    } catch {
      db = "down";
    }
    // Drive is optional (DEGRADED mode when unconfigured) — report configured
    // vs not, not up/down, since a probe would spend a real API call.
    const drive = this.drive.isConfigured() ? "configured" : "not_configured";
    return {
      status: db === "up" ? "ok" : "degraded",
      db,
      drive,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
