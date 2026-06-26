# Computer Refurbishment & Inventory Management System

> Hệ thống quản lý cửa hàng mua bán máy tính cũ, tháo linh kiện, lắp ráp máy và quản lý kho.

---

# 1. Giới thiệu

Đây là hệ thống ERP thu nhỏ dành riêng cho mô hình kinh doanh:

* Mua máy tính cũ
* Mua linh kiện rời
* Kiểm tra và phân loại
* Tháo máy lấy linh kiện
* Quản lý kho linh kiện
* Lắp ráp máy mới
* Bán máy hoặc bán linh kiện
* Quản lý bảo hành
* Theo dõi tồn kho và lợi nhuận

Khác với phần mềm bán hàng thông thường, hệ thống này phải quản lý được vòng đời của từng linh kiện.

---

# 2. Mục tiêu

Giải quyết các vấn đề:

* Không biết máy mua vào có những linh kiện gì
* Không biết linh kiện đã tháo hay chưa
* Không biết linh kiện đang nằm ở máy nào
* Không biết giá vốn thực tế của từng máy
* Không biết tồn kho còn bao nhiêu
* Không biết lợi nhuận của từng đơn hàng

---

# 3. Quy trình nghiệp vụ

```
Mua máy cũ
        │
        ▼
Kiểm tra cấu hình
        │
        ▼
Phân bổ giá vốn
        │
        ▼
Tháo máy
        │
        ▼
Nhập kho linh kiện
        │
        ├───────────────┐
        ▼               ▼
Bán linh kiện      Lắp ráp máy
                        │
                        ▼
                  Kiểm tra chất lượng
                        │
                        ▼
                  Nhập kho thành phẩm
                        │
                        ▼
                     Bán hàng
                        │
                        ▼
                     Bảo hành
```

---

# 4. Module hệ thống

## Dashboard

Hiển thị:

* Doanh thu
* Lợi nhuận
* Giá trị tồn kho
* Máy đang có
* Linh kiện tồn
* Máy chờ test
* Đơn bảo hành

---

## Mua hàng

Quản lý:

* Máy cũ
* Linh kiện rời

Thông tin:

* Mã phiếu
* Nhà cung cấp
* Người bán
* Giá mua
* Chi phí
* Ghi chú

---

## Kiểm tra máy

Khai báo:

* CPU
* Mainboard
* RAM
* SSD
* HDD
* VGA
* PSU
* Case
* Fan
* WiFi
* Bluetooth
* Phụ kiện khác

Đánh giá:

* Tốt
* Cần sửa
* Lỗi
* Thanh lý

---

## Tháo máy

Sau khi tháo:

* Máy chuyển trạng thái "Đã tháo"
* Sinh các linh kiện
* Nhập kho tự động

---

## Kho linh kiện

Quản lý từng linh kiện theo:

* Mã nội bộ
* Serial
* Loại
* Model
* Tình trạng
* Giá vốn
* Vị trí
* Trạng thái

Có thể tìm kiếm theo:

* Serial
* Mã
* Model
* Loại

---

## Lắp ráp

Tạo máy mới bằng cách:

Chọn:

* CPU
* Main
* RAM
* SSD
* VGA
* PSU
* Case

Sau khi hoàn tất:

* Xuất kho linh kiện
* Sinh máy thành phẩm

---

## Máy thành phẩm

Lưu:

* Cấu hình
* Giá vốn
* Giá bán đề xuất
* Danh sách linh kiện
* Lịch sử sửa chữa

---

## Bán hàng

Có thể bán:

* Máy
* Linh kiện

Tự động:

* Xuất kho
* Ghi nhận doanh thu
* Tính lợi nhuận

---

## Bảo hành

Tra cứu theo:

* Mã máy
* Serial
* Khách hàng
* Đơn hàng

Theo dõi:

* Tiếp nhận
* Kiểm tra
* Thay linh kiện
* Hoàn thành

---

## Báo cáo

Báo cáo:

* Tồn kho
* Doanh thu
* Lợi nhuận
* Linh kiện bán chạy
* Máy bán chạy
* Giá trị kho
* Lợi nhuận theo tháng

---

# 5. Trạng thái

## Máy mua vào

```
NEW
CHECKED
DISASSEMBLED
READY_FOR_SALE
SOLD
SCRAP
```

---

## Linh kiện

```
IN_STOCK
ASSEMBLED
SOLD
DEFECTIVE
WARRANTY
SCRAP
```

---

## Máy thành phẩm

```
ASSEMBLING
TESTING
READY
SOLD
WARRANTY
RETURNED
```

---

# 6. Mã định danh

Máy

```
PC000001
```

CPU

```
CPU000001
```

Main

```
MB000001
```

RAM

```
RAM000001
```

SSD

```
SSD000001
```

HDD

```
HDD000001
```

VGA

```
GPU000001
```

Nguồn

```
PSU000001
```

Case

```
CASE000001
```

---

# 7. Cấu trúc Database

```
users

roles

customers

suppliers

purchase_orders

purchase_items

machines

machine_components

components

assembly_orders

assembly_items

finished_pcs

sales_orders

sales_items

stock_transactions

warranty_cases

expenses

attachments

activity_logs
```

---

# 8. Luồng dữ liệu

## Mua máy

```
Purchase Order

↓

Machine

↓

Machine Components
```

---

## Tháo máy

```
Machine

↓

Component

↓

Stock Transaction(IN)
```

---

## Lắp ráp

```
Assembly Order

↓

Stock Transaction(OUT)

↓

Finished PC
```

---

## Bán hàng

```
Finished PC

↓

Sales Order

↓

Stock Transaction
```

---

# 9. Quy tắc tính giá vốn

Máy mua:

```
5.000.000
```

Phân bổ:

```
CPU     1.300.000

Main    1.200.000

RAM       500.000

SSD       700.000

PSU       500.000

Case      800.000
```

Giá vốn linh kiện được giữ cố định sau khi nhập.

Khi lắp máy:

```
Giá vốn máy

=

Tổng giá vốn linh kiện

+

Chi phí sửa chữa

+

Chi phí vệ sinh

+

Chi phí lắp ráp
```

---

# 10. Quy tắc kho

Mọi thay đổi đều sinh Stock Transaction.

Không được sửa trực tiếp số lượng tồn.

Chỉ có:

```
IN

OUT

TRANSFER

ADJUSTMENT

RETURN

SCRAP
```

---

# 11. Công nghệ đề xuất

## Backend

* NestJS
* PostgreSQL
* Prisma ORM
* Redis
* BullMQ

---

## Frontend

* Next.js
* React
* TypeScript
* TailwindCSS
* shadcn/ui

---

## Authentication

* JWT
* Refresh Token
* RBAC

---

## Storage

* S3 Compatible
* MinIO

---

## Deployment

* Docker
* Docker Compose
* Nginx

---

# 12. Phân quyền

Administrator

* Toàn quyền

Kho

* Nhập
* Xuất
* Kiểm kê

Kỹ thuật

* Kiểm tra máy
* Tháo máy
* Lắp ráp

Bán hàng

* Tạo đơn
* Quản lý khách

Kế toán

* Doanh thu
* Chi phí
* Báo cáo

---

# 13. Roadmap

## Phase 1

* Đăng nhập
* Dashboard
* Mua hàng
* Tháo máy
* Kho linh kiện

---

## Phase 2

* Lắp ráp
* Máy thành phẩm
* Bán hàng

---

## Phase 3

* Bảo hành
* In tem QR
* Barcode
* Báo cáo nâng cao

---

## Phase 4

* Mobile App
* Đồng bộ nhiều chi nhánh
* AI định giá linh kiện
* AI gợi ý cấu hình
* AI dự đoán tồn kho

---

# 14. Nguyên tắc thiết kế

1. Mỗi linh kiện là một thực thể độc lập.

2. Một linh kiện chỉ được thuộc về một máy tại một thời điểm.

3. Không được xóa lịch sử.

4. Mọi thay đổi đều ghi Activity Log.

5. Mọi nhập xuất đều sinh Stock Transaction.

6. Giá vốn sau khi xác nhận sẽ không thay đổi.

7. Mọi máy bán ra đều có thể truy ngược đến từng linh kiện bên trong.

---

# 15. Mục tiêu cuối cùng

Hệ thống phải trả lời được ngay lập tức các câu hỏi sau:

* CPU này lấy từ máy nào?
* Máy này đang chứa những linh kiện nào?
* SSD này đã bán chưa?
* Giá vốn của máy này là bao nhiêu?
* Lợi nhuận của đơn hàng này là bao nhiêu?
* Trong kho còn bao nhiêu RAM 8GB?
* Linh kiện nào đang bảo hành?
* Một linh kiện đã từng đi qua những máy nào?
* Giá trị tồn kho hiện tại là bao nhiêu?

Nếu hệ thống trả lời chính xác các câu hỏi trên, thì toàn bộ quy trình quản lý cửa hàng đã được số hóa thành công.
