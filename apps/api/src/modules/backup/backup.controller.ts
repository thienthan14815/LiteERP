import { Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { BackupService } from "./backup.service";

// VN: `system:admin` không có trong seed hiện tại — PermissionsGuard vẫn cho
// user role ADMIN bypass (line 33). Nếu muốn giới hạn hẹp hơn, seed thêm
// permission `system:admin` và gán cho role phù hợp.
@Controller("backup")
export class BackupController {
  constructor(private readonly svc: BackupService) {}

  @Post("run")
  @Permissions("system:admin")
  run() {
    return this.svc.dumpAndUpload();
  }

  @Get()
  @Permissions("system:admin")
  list() {
    return this.svc.list();
  }

  @Delete(":id")
  @Permissions("system:admin")
  remove(@Param("id") id: string) {
    return this.svc.remove(id);
  }
}
