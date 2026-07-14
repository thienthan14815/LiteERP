import { Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { MaintenanceQueueService } from "../../jobs/queues/maintenance.queue";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly maintenance: MaintenanceQueueService) {}

  @Post("low-stock-alert/run")
  @HttpCode(HttpStatus.ACCEPTED)
  @Permissions("*")
  async run() {
    const jobId = await this.maintenance.enqueueLowStockAlert();
    return { jobId };
  }
}
