import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { typedConfig } from "./config/configuration";
import { PrismaModule } from "./database/prisma.module";
import { QueueModule } from "./jobs/queue.module";

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
import { WarrantiesModule } from "./modules/warranties/warranties.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { AuditLogsModule } from "./modules/audit-logs/audit-logs.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [typedConfig],
    }),
    PrismaModule,
    QueueModule,
    AuthModule,
    UsersModule,
    RolesModule,
    SuppliersModule,
    CustomersModule,
    PurchasesModule,
    MachinesModule,
    ComponentsModule,
    InventoryModule,
    AssembliesModule,
    FinishedPcsModule,
    SalesModule,
    WarrantiesModule,
    ReportsModule,
    AuditLogsModule,
  ],
})
export class AppModule {}
