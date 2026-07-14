# ARCHITECTURE.md

> ⚠️ **LEGACY / REFERENCE ONLY.** This document describes the original online,
> multi-user server topology (NestJS + PostgreSQL + Redis + BullMQ + S3/MinIO +
> Docker/Nginx). The project has since pivoted to a **single standalone Android
> APK** with an on-device NestJS server over **SQLite** (see
> `ARCHITECTURE_forSQL.md` and `README.md`). Redis/BullMQ/Postgres/S3 and Docker
> Compose are no longer part of the shipped app. Read this only for historical
> context or if you intend to run the legacy server stack.

# Computer Refurbishment & Inventory Management System Architecture

> Kiến trúc hệ thống webapp quản lý mua bán máy tính cũ, tháo linh kiện, kho linh kiện, lắp ráp máy, bán hàng và bảo hành.

---

# 1. Mục tiêu kiến trúc

Hệ thống được thiết kế để chạy online, nhiều người dùng có thể truy cập cùng lúc, dữ liệu được lưu trữ an toàn, có thể mở rộng và bảo trì lâu dài.

Mục tiêu chính:

* Chạy được trên internet bằng domain riêng.
* Hỗ trợ nhiều nhân viên sử dụng cùng lúc.
* Quản lý chính xác tồn kho theo từng linh kiện.
* Không mất lịch sử nhập, xuất, bán, bảo hành.
* Có phân quyền người dùng.
* Có backup dữ liệu.
* Có khả năng mở rộng thành SaaS hoặc multi-branch sau này.

---

# 2. Tổng quan hệ thống

```text
User Browser
    │
    ▼
Frontend Web App
    │
    ▼
Reverse Proxy / Load Balancer
    │
    ▼
Backend API Server
    │
    ├──────────────► PostgreSQL Database
    │
    ├──────────────► Redis Cache / Queue
    │
    ├──────────────► Object Storage
    │
    ├──────────────► Email Service
    │
    └──────────────► Logging / Monitoring
```

---

# 3. Công nghệ đề xuất

## Frontend

```text
Next.js
React
TypeScript
TailwindCSS
shadcn/ui
TanStack Query
Zod
React Hook Form
```

Lý do chọn:

* Next.js phù hợp cho webapp hiện đại.
* TypeScript giảm lỗi khi phát triển lâu dài.
* TailwindCSS dễ làm giao diện quản trị.
* TanStack Query tốt cho cache dữ liệu API.
* Zod giúp validate form và dữ liệu.

---

## Backend

```text
NestJS
TypeScript
Prisma ORM
PostgreSQL
Redis
BullMQ
JWT Authentication
RBAC Authorization
```

Lý do chọn:

* NestJS có kiến trúc rõ ràng, dễ mở rộng.
* Prisma giúp quản lý database schema tốt.
* PostgreSQL phù hợp với dữ liệu nghiệp vụ phức tạp.
* Redis dùng cho cache và queue.
* BullMQ dùng cho tác vụ nền như gửi email, tạo báo cáo, backup.

---

## Database

```text
PostgreSQL
```

Dùng để lưu:

* Người dùng
* Khách hàng
* Nhà cung cấp
* Phiếu mua
* Máy mua vào
* Linh kiện
* Kho
* Phiếu lắp ráp
* Đơn bán
* Bảo hành
* Lịch sử nhập xuất
* Nhật ký thao tác

---

## Storage

```text
S3 Compatible Storage
```

Có thể dùng:

* AWS S3
* Cloudflare R2
* MinIO
* DigitalOcean Spaces

Dùng để lưu:

* Ảnh linh kiện
* Ảnh máy
* Ảnh hóa đơn
* File đính kèm
* Tem QR
* Báo cáo xuất file

---

## Cache / Queue

```text
Redis
BullMQ
```

Dùng cho:

* Cache dữ liệu dashboard
* Queue gửi email
* Queue tạo báo cáo
* Queue backup
* Queue xử lý ảnh
* Queue import Excel

---

# 4. Kiến trúc thư mục đề xuất

## Monorepo

```text
computer-refurb-system/
│
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── types/
│   │
│   └── api/
│       ├── src/
│       │   ├── modules/
│       │   ├── common/
│       │   ├── config/
│       │   ├── database/
│       │   ├── jobs/
│       │   └── main.ts
│       │
│       └── prisma/
│           ├── schema.prisma
│           └── migrations/
│
├── packages/
│   ├── shared/
│   ├── ui/
│   └── config/
│
├── docker/
├── docs/
├── scripts/
├── .env.example
├── docker-compose.yml
├── package.json
└── README.md
```

---

# 5. Frontend Architecture

## Cấu trúc frontend

```text
apps/web/
│
├── app/
│   ├── login/
│   ├── dashboard/
│   ├── purchases/
│   ├── machines/
│   ├── components/
│   ├── assemblies/
│   ├── finished-pcs/
│   ├── sales/
│   ├── warranties/
│   ├── reports/
│   └── settings/
│
├── components/
│   ├── ui/
│   ├── forms/
│   ├── tables/
│   ├── dialogs/
│   └── layout/
│
├── features/
│   ├── auth/
│   ├── purchase/
│   ├── inventory/
│   ├── assembly/
│   ├── sales/
│   ├── warranty/
│   └── reports/
│
├── lib/
│   ├── api-client.ts
│   ├── auth.ts
│   ├── permissions.ts
│   └── validators.ts
│
└── types/
```

---

## Nguyên tắc frontend

* Mỗi module nghiệp vụ nằm trong `features`.
* Component dùng lại nằm trong `components`.
* API client tập trung tại `lib/api-client.ts`.
* Validate form bằng Zod.
* Table phải hỗ trợ filter, sort, pagination.
* Mọi thao tác quan trọng phải có confirm dialog.
* Không hard-code role hoặc permission trong component.

---

# 6. Backend Architecture

## Cấu trúc backend

```text
apps/api/src/
│
├── modules/
│   ├── auth/
│   ├── users/
│   ├── roles/
│   ├── suppliers/
│   ├── customers/
│   ├── purchases/
│   ├── machines/
│   ├── components/
│   ├── inventory/
│   ├── assemblies/
│   ├── finished-pcs/
│   ├── sales/
│   ├── warranties/
│   ├── reports/
│   └── audit-logs/
│
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── interceptors/
│   ├── filters/
│   ├── dto/
│   └── utils/
│
├── config/
├── database/
├── jobs/
└── main.ts
```

---

## Mỗi backend module gồm

```text
module-name/
│
├── module-name.controller.ts
├── module-name.service.ts
├── module-name.repository.ts
├── dto/
├── entities/
├── policies/
└── tests/
```

---

# 7. API Design

API sử dụng REST.

Base URL:

```text
https://api.example.com/api/v1
```

Ví dụ endpoint:

```text
POST   /auth/login
POST   /auth/refresh
GET    /dashboard

GET    /purchases
POST   /purchases
GET    /purchases/:id
PATCH  /purchases/:id
POST   /purchases/:id/confirm

POST   /machines/:id/inspect
POST   /machines/:id/disassemble

GET    /components
POST   /components
GET    /components/:id
PATCH  /components/:id

POST   /assemblies
POST   /assemblies/:id/complete

POST   /sales
POST   /sales/:id/cancel

POST   /warranties
PATCH  /warranties/:id/status

GET    /reports/profit
GET    /reports/inventory-value
```

---

# 8. Authentication

Sử dụng:

```text
JWT Access Token
Refresh Token
Password Hashing
```

Quy trình:

```text
User login
    ↓
Backend kiểm tra tài khoản
    ↓
Trả về access token + refresh token
    ↓
Frontend lưu token an toàn
    ↓
Gọi API bằng Authorization Header
```

Access Token nên ngắn hạn:

```text
15 phút
```

Refresh Token dài hơn:

```text
7 ngày đến 30 ngày
```

---

# 9. Authorization

Sử dụng RBAC.

## Role đề xuất

```text
ADMIN
MANAGER
WAREHOUSE
TECHNICIAN
SALES
ACCOUNTANT
VIEWER
```

## Permission ví dụ

```text
purchase:create
purchase:update
purchase:confirm

machine:inspect
machine:disassemble

component:create
component:update
component:delete

assembly:create
assembly:complete

sale:create
sale:cancel

warranty:create
warranty:update

report:view
setting:update
```

---

# 10. Database Design Overview

Các bảng chính:

```text
users
roles
permissions
user_roles
role_permissions

suppliers
customers

purchase_orders
purchase_items

machines
machine_components

components
component_categories

warehouses
stock_transactions

assembly_orders
assembly_items

finished_pcs
finished_pc_components

sales_orders
sales_items

warranty_cases
warranty_items

expenses
attachments
audit_logs
```

---

# 11. Inventory Architecture

Kho không được tính bằng cách sửa số lượng trực tiếp.

Tồn kho được tính từ:

```text
stock_transactions
```

Các loại giao dịch kho:

```text
IN
OUT
TRANSFER
ADJUSTMENT
RETURN
SCRAP
```

Ví dụ:

```text
Component RAM000001 nhập kho
→ Stock Transaction: IN

Component RAM000001 dùng lắp máy
→ Stock Transaction: OUT

Component RAM000001 bị lỗi
→ Stock Transaction: SCRAP
```

Nguyên tắc:

* Không xóa transaction.
* Chỉ tạo transaction bù nếu sai.
* Mọi transaction phải có người tạo.
* Mọi transaction phải có lý do.
* Mọi transaction phải liên kết đến nghiệp vụ gốc.

---

# 12. Component Lifecycle

```text
CREATED
    ↓
IN_STOCK
    ↓
RESERVED
    ↓
ASSEMBLED
    ↓
SOLD
```

Các nhánh phụ:

```text
DEFECTIVE
WARRANTY
RETURNED
SCRAPPED
LOST
```

Một linh kiện chỉ được ở một trạng thái chính tại một thời điểm.

---

# 13. Machine Lifecycle

## Máy mua vào

```text
PURCHASED
    ↓
INSPECTED
    ↓
DISASSEMBLED
```

Hoặc:

```text
PURCHASED
    ↓
INSPECTED
    ↓
READY_FOR_RESALE
    ↓
SOLD
```

---

## Máy thành phẩm

```text
DRAFT
    ↓
ASSEMBLING
    ↓
TESTING
    ↓
READY_FOR_SALE
    ↓
SOLD
```

Nhánh phụ:

```text
WARRANTY
RETURNED
DEFECTIVE
SCRAPPED
```

---

# 14. Business Transaction Boundary

Các thao tác sau phải chạy trong database transaction:

* Xác nhận phiếu mua.
* Tháo máy.
* Nhập linh kiện.
* Lắp ráp máy.
* Hoàn tất lắp ráp.
* Bán hàng.
* Hủy đơn bán.
* Nhận bảo hành.
* Thay linh kiện bảo hành.
* Thanh lý linh kiện.

Ví dụ khi bán máy:

```text
BEGIN TRANSACTION

1. Tạo sales_order
2. Tạo sales_items
3. Chuyển finished_pc sang SOLD
4. Chuyển linh kiện bên trong sang SOLD
5. Tạo stock_transaction OUT
6. Tạo audit_log

COMMIT
```

Nếu lỗi ở bất kỳ bước nào:

```text
ROLLBACK
```

---

# 15. Background Jobs

Các tác vụ nền:

```text
send-email.job
generate-report.job
export-excel.job
backup-database.job
generate-qr-code.job
process-image.job
low-stock-alert.job
```

Dùng BullMQ + Redis.

---

# 16. File Upload Architecture

File upload gồm:

* Ảnh linh kiện
* Ảnh máy
* Hóa đơn
* Phiếu bảo hành
* File import Excel

Quy trình:

```text
Frontend request upload URL
        ↓
Backend tạo signed URL
        ↓
Frontend upload file lên S3
        ↓
Backend lưu metadata file
```

Bảng `attachments` lưu:

```text
id
file_name
file_url
file_type
mime_type
size
related_type
related_id
created_by
created_at
```

---

# 17. Logging & Audit

Cần có 2 loại log.

## Application Log

Dùng cho dev:

```text
error
warning
info
debug
```

## Audit Log

Dùng cho nghiệp vụ:

```text
Ai làm?
Làm gì?
Làm lúc nào?
Dữ liệu cũ?
Dữ liệu mới?
IP?
Thiết bị?
```

Ví dụ:

```text
User A changed component RAM000001 status from IN_STOCK to ASSEMBLED
```

---

# 18. Error Handling

Response lỗi chuẩn:

```json
{
  "success": false,
  "error": {
    "code": "COMPONENT_NOT_AVAILABLE",
    "message": "Linh kiện không khả dụng trong kho",
    "details": {}
  }
}
```

HTTP status:

```text
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Validation Error
500 Internal Server Error
```

---

# 19. Validation

Validate ở cả frontend và backend.

Ví dụ:

* Giá mua phải >= 0.
* Giá bán phải >= 0.
* Không được bán máy chưa READY.
* Không được lắp linh kiện không còn trong kho.
* Không được xóa đơn đã phát sinh giao dịch.
* Tổng giá vốn phân bổ phải bằng tổng giá mua.
* Serial không được trùng nếu đã khai báo là unique.

---

# 20. Security

Yêu cầu bảo mật:

* HTTPS bắt buộc.
* Hash password bằng Argon2 hoặc bcrypt.
* JWT hết hạn ngắn.
* Refresh token rotation.
* RBAC.
* Rate limit login.
* Validate input.
* Chống SQL injection bằng ORM.
* Chống XSS.
* Chống CSRF nếu dùng cookie auth.
* Không lưu file upload trực tiếp trên server app.
* Không public file nhạy cảm.
* Backup định kỳ.
* Ghi audit log cho thao tác quan trọng.

---

# 21. Deployment Architecture

## Production

```text
Internet
   ↓
Cloudflare
   ↓
Nginx
   ↓
Docker Network
   ├── web container
   ├── api container
   ├── worker container
   ├── postgres container / managed postgres
   ├── redis container / managed redis
   └── minio / s3 storage
```

---

## Docker services

```yaml
services:
  web:
    image: computer-refurb-web

  api:
    image: computer-refurb-api

  worker:
    image: computer-refurb-worker

  postgres:
    image: postgres:16

  redis:
    image: redis:7

  nginx:
    image: nginx:latest
```

---

# 22. Environment Variables

```env
NODE_ENV=production

APP_URL=https://example.com
API_URL=https://api.example.com

DATABASE_URL=postgresql://user:password@postgres:5432/app

REDIS_URL=redis://redis:6379

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

---

# 23. CI/CD

Pipeline đề xuất:

```text
Push code
    ↓
Install dependencies
    ↓
Lint
    ↓
Type check
    ↓
Unit test
    ↓
Build Docker image
    ↓
Run migration
    ↓
Deploy
```

---

# 24. Backup Strategy

Cần backup:

* PostgreSQL
* File storage
* Environment config

Lịch backup:

```text
Database: mỗi ngày
File storage: mỗi ngày
Retention: 7 ngày daily, 4 tuần weekly, 12 tháng monthly
```

Cần test restore định kỳ.

Backup không có ý nghĩa nếu chưa từng test khôi phục.

---

# 25. Monitoring

Theo dõi:

* CPU
* RAM
* Disk
* Database connection
* API latency
* Error rate
* Queue failed jobs
* Storage usage
* Backup status

Có thể dùng:

```text
Grafana
Prometheus
Loki
Sentry
Uptime Kuma
```

---

# 26. Performance

Các điểm cần tối ưu:

* Pagination cho mọi danh sách.
* Index database cho mã, serial, trạng thái, ngày tạo.
* Cache dashboard.
* Không load toàn bộ lịch sử nếu không cần.
* Export báo cáo chạy bằng background job.
* Search linh kiện cần index theo serial, model, mã nội bộ.

---

# 27. Database Index đề xuất

```sql
CREATE INDEX idx_components_code ON components(code);
CREATE INDEX idx_components_serial ON components(serial_number);
CREATE INDEX idx_components_status ON components(status);
CREATE INDEX idx_components_category ON components(category_id);

CREATE INDEX idx_stock_transactions_component ON stock_transactions(component_id);
CREATE INDEX idx_stock_transactions_created_at ON stock_transactions(created_at);

CREATE INDEX idx_sales_orders_created_at ON sales_orders(created_at);
CREATE INDEX idx_purchase_orders_created_at ON purchase_orders(created_at);
```

---

# 28. Multi-branch Ready Design

Nếu sau này có nhiều chi nhánh, thêm:

```text
branches
warehouses
branch_users
stock_transfers
```

Mọi bảng nghiệp vụ nên có:

```text
branch_id
```

Ngay từ đầu nên thiết kế sẵn `branch_id`, kể cả ban đầu chỉ có một chi nhánh.

---

# 29. Multi-tenant Ready Design

Nếu sau này muốn bán phần mềm cho cửa hàng khác, thêm:

```text
tenant_id
```

Mọi bảng nghiệp vụ nên có:

```text
tenant_id
```

Nếu chỉ dùng nội bộ một cửa hàng, vẫn có thể giữ `tenant_id` để dễ mở rộng.

---

# 30. Non-functional Requirements

Hệ thống production cần đạt:

```text
Uptime: >= 99%
API response trung bình: < 500ms
Danh sách lớn phải pagination
Backup tự động hàng ngày
Có audit log
Có phân quyền
Có HTTPS
Có restore plan
Có monitoring
```

---

# 31. MVP Production Spec

Phiên bản online đầu tiên cần có:

```text
Frontend:
- Login
- Dashboard
- Mua hàng
- Kiểm tra máy
- Tháo máy
- Kho linh kiện
- Lắp ráp
- Bán hàng
- Báo cáo cơ bản

Backend:
- Auth
- RBAC
- Purchase API
- Machine API
- Component API
- Inventory API
- Assembly API
- Sales API
- Report API

Database:
- PostgreSQL
- Prisma migration
- Seed admin user

Infrastructure:
- Docker Compose
- Nginx
- HTTPS
- Backup database
- Basic monitoring
```

---

# 32. Future Extensions

Có thể mở rộng:

* Quét QR bằng điện thoại.
* In tem linh kiện.
* Import Excel.
* Xuất hóa đơn PDF.
* Đồng bộ nhiều chi nhánh.
* Tích hợp Zalo / Facebook.
* Tích hợp sàn thương mại điện tử.
* AI gợi ý giá bán.
* AI gợi ý cấu hình lắp ráp.
* Mobile app cho kỹ thuật viên.

---

# 33. Kết luận

Kiến trúc phù hợp nhất cho hệ thống này là:

```text
Next.js frontend
+
NestJS backend
+
PostgreSQL database
+
Redis queue/cache
+
S3-compatible file storage
+
Docker deployment
```

Điểm cốt lõi không nằm ở giao diện, mà nằm ở:

```text
Component lifecycle
Stock transaction
Cost tracking
Audit log
Business transaction
```

Nếu 5 phần này làm đúng, hệ thống sẽ quản lý được chính xác mô hình:

```text
Mua máy cũ → Tháo linh kiện → Nhập kho → Lắp ráp → Bán hàng → Bảo hành
```
