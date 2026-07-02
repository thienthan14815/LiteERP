import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { typedConfig } from "./config/configuration";
import { PrismaModule } from "./database/prisma.module";
import { QueueModule } from "./jobs/queue.module";
import { RepositoryModule } from "./repository/repository.module";
import { DriveModule } from "./modules/drive/drive.module";
import { BackupModule } from "./modules/backup/backup.module";

import { RequestContextModule } from "./common/context/request-context.module";
import { CodeGeneratorModule } from "./common/utils/code-generator.module";
import { RequestContextInterceptor } from "./common/interceptors/request-context.interceptor";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";

import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { RolesModule } from "./modules/roles/roles.module";
import { SuppliersModule } from "./modules/suppliers/suppliers.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { PurchasesModule } from "./modules/purchases/purchases.module";
import { MachinesModule } from "./modules/machines/machines.module";
import { ComponentsModule } from "./modules/components/components.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { AssembliesModule } from "./modules/assemblies/assemblies.module";
import { FinishedPcsModule } from "./modules/finished-pcs/finished-pcs.module";
import { SalesModule } from "./modules/sales/sales.module";
import { MasterOptionsModule } from "./modules/master-options/master-options.module";
import { WarrantiesModule } from "./modules/warranties/warranties.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { AuditLogsModule } from "./modules/audit-logs/audit-logs.module";
import { AttachmentsModule } from "./modules/attachments/attachments.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [typedConfig] }),
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 100 }]),
    PrismaModule,
    RepositoryModule,
    DriveModule,
    RequestContextModule,
    CodeGeneratorModule,
    QueueModule,
    AuditLogsModule,
    BackupModule,
    InventoryModule,
    AuthModule,
    UsersModule,
    RolesModule,
    SuppliersModule,
    CustomersModule,
    PurchasesModule,
    MachinesModule,
    ComponentsModule,
    AssembliesModule,
    FinishedPcsModule,
    SalesModule,
    MasterOptionsModule,
    WarrantiesModule,
    ReportsModule,
    AttachmentsModule,
    NotificationsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
  ],
})
export class AppModule {}
