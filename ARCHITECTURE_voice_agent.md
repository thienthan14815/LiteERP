# ARCHITECTURE_VOICE_AGENT.md

# Voice Agent Architecture for Computer Refurbishment System

> Kiến trúc agent điều khiển bằng giọng nói cho hệ thống quản lý mua máy cũ, tháo linh kiện, nhập kho, lắp ráp, bán hàng và bảo hành.

---

# 1. Mục tiêu

Chức năng chính của hệ thống là giúp chủ cửa hàng và nhân viên giảm nhập liệu thủ công.

Người dùng chỉ cần:

```text
Bấm nút voice
    ↓
Nói yêu cầu
    ↓
Agent nghe và phân tích
    ↓
Agent hỏi lại nếu thiếu thông tin
    ↓
Agent gọi skill phù hợp
    ↓
Hệ thống tự tạo dữ liệu
    ↓
Người dùng xác nhận
```

Ví dụ:

```text
"Tôi vừa mua một bộ Dell 7060, i5 8500, RAM 8GB, SSD 256GB, giá 4 triệu 8."
```

Agent sẽ tự hiểu:

```text
Intent: tạo phiếu mua máy cũ
Machine: Dell 7060
CPU: i5 8500
RAM: 8GB
SSD: 256GB
Price: 4.800.000
Action: create_purchase_order
```

---

# 2. Triết lý thiết kế

Agent không chỉ là chatbot.

Agent là lớp điều khiển nghiệp vụ bằng ngôn ngữ tự nhiên.

```text
User Voice
    ↓
Speech To Text
    ↓
Intent Detection
    ↓
Slot Extraction
    ↓
Validation
    ↓
Skill Selection
    ↓
Business Action
    ↓
Confirmation
```

Nguyên tắc:

```text
1. Không bắt người dùng nhập form nếu có thể nói.
2. Agent phải hỏi lại khi thiếu dữ liệu quan trọng.
3. Agent không tự tạo giao dịch quan trọng nếu chưa xác nhận.
4. Mọi hành động của agent phải có audit log.
5. Skill phải có input/output rõ ràng.
6. Agent không được sửa kho trực tiếp, chỉ gọi API nghiệp vụ.
```

---

# 3. Tổng quan kiến trúc

```text
Mobile App / Web App
        │
        ▼
Voice Button UI
        │
        ▼
Audio Recorder
        │
        ▼
Speech-to-Text Service
        │
        ▼
Agent Orchestrator
        │
        ├── Intent Classifier
        ├── Entity Extractor
        ├── Context Manager
        ├── Skill Router
        ├── Clarification Engine
        ├── Confirmation Engine
        └── Memory / Session State
        │
        ▼
Skill Layer
        │
        ├── Purchase Skill
        ├── Component Skill
        ├── Inventory Skill
        ├── Disassembly Skill
        ├── Assembly Skill
        ├── Sales Skill
        ├── Warranty Skill
        ├── Report Skill
        ├── Photo Analyze Skill
        └── Search Skill
        │
        ▼
Backend Business API
        │
        ▼
PostgreSQL Database
```

---

# 4. Thành phần hệ thống

## 4.1 Voice Button UI

Nút voice là điểm bắt đầu chính.

Nút này xuất hiện ở:

```text
Dashboard
Mua hàng
Kho linh kiện
Lắp ráp
Bán hàng
Bảo hành
Mobile app bottom navigation
```

Trạng thái nút:

```text
Idle
Listening
Processing
Need Confirmation
Need More Information
Success
Error
```

Ví dụ UI:

```text
[🎙 Nói với Agent]
```

Khi bấm:

```text
Agent: Tôi đang nghe, anh muốn làm gì?
```

---

## 4.2 Speech-to-Text

Nhiệm vụ:

```text
Chuyển giọng nói thành text
```

Input:

```text
audio/webm
audio/mp3
audio/wav
audio/m4a
```

Output:

```json
{
  "transcript": "Tôi vừa mua một bộ Dell 7060 i5 8500 ram 8gb ssd 256 giá 4 triệu 8",
  "language": "vi",
  "confidence": 0.92
}
```

Yêu cầu:

```text
Hỗ trợ tiếng Việt
Nhận được số tiền tiếng Việt
Nhận được tên linh kiện
Nhận được model máy
Có confidence score
```

---

# 5. Agent Orchestrator

Agent Orchestrator là bộ não trung tâm.

Nhiệm vụ:

```text
Nhận transcript
Hiểu ý định
Tách dữ liệu
Kiểm tra dữ liệu thiếu
Chọn skill phù hợp
Gọi skill
Trả kết quả
```

Luồng xử lý:

```text
Transcript
    ↓
Normalize text
    ↓
Detect intent
    ↓
Extract entities
    ↓
Validate required fields
    ↓
If missing → ask clarification
    ↓
If risky → ask confirmation
    ↓
Execute skill
    ↓
Return result
```

---

# 6. Intent Detection

Agent cần nhận diện các intent chính.

## 6.1 Purchase Intent

```text
create_purchase_machine
create_purchase_component
update_purchase
confirm_purchase
```

Ví dụ:

```text
"Tôi vừa mua một cây RAM 8GB giá 300 nghìn"
"Mua một bộ Dell Optiplex 7060 giá 5 triệu"
```

---

## 6.2 Inventory Intent

```text
search_component
check_stock
move_stock
adjust_stock
mark_component_defective
scrap_component
```

Ví dụ:

```text
"Trong kho còn bao nhiêu RAM 8GB?"
"Tìm SSD Kingston 256"
"Đánh dấu con nguồn này bị lỗi"
```

---

## 6.3 Disassembly Intent

```text
inspect_machine
disassemble_machine
create_components_from_machine
```

Ví dụ:

```text
"Tháo máy Dell 7060 này ra, có CPU i5 8500, RAM 8GB, SSD 256"
```

---

## 6.4 Assembly Intent

```text
create_assembly
add_component_to_assembly
complete_assembly
```

Ví dụ:

```text
"Lắp cho tôi một cây máy gaming dùng i5 8500, RAM 16GB, SSD 512, VGA 1660"
```

---

## 6.5 Sales Intent

```text
create_sale
sell_component
sell_finished_pc
cancel_sale
```

Ví dụ:

```text
"Bán máy PCSALE0001 cho anh Nam giá 9 triệu rưỡi, bảo hành 3 tháng"
```

---

## 6.6 Warranty Intent

```text
create_warranty_case
update_warranty_status
replace_component
return_to_customer
```

Ví dụ:

```text
"Khách mang máy hôm qua quay lại, lỗi SSD, tạo phiếu bảo hành cho máy này"
```

---

## 6.7 Report Intent

```text
today_revenue
monthly_profit
inventory_value
low_stock_report
sales_report
```

Ví dụ:

```text
"Hôm nay bán được bao nhiêu?"
"Tháng này lãi bao nhiêu?"
"Kho còn bao nhiêu tiền hàng?"
```

---

## 6.8 Photo Analyze Intent

```text
analyze_product_photo
extract_component_from_photo
extract_invoice_from_photo
```

Ví dụ:

```text
"Phân tích ảnh này xem có linh kiện gì"
"Đọc hóa đơn này rồi nhập giúp tôi"
```

---

# 7. Entity Extraction

Agent phải tách được các dữ liệu sau.

## 7.1 Product Entities

```text
machine_model
component_type
component_model
cpu_model
ram_size
ram_type
ssd_size
hdd_size
vga_model
psu_watt
case_type
serial_number
condition
```

Ví dụ:

```text
"i5 8500" → cpu_model
"RAM 8GB DDR4" → ram_size + ram_type
"SSD 256 Kingston" → component_type + size + brand
```

---

## 7.2 Transaction Entities

```text
purchase_price
sale_price
quantity
customer_name
supplier_name
warranty_months
payment_method
discount
expense
```

Ví dụ:

```text
"4 triệu 8" → 4.800.000
"ba trăm rưỡi" → 350.000
"bảo hành 3 tháng" → warranty_months = 3
```

---

## 7.3 Action Entities

```text
action
target
status
date
branch
warehouse_location
```

Ví dụ:

```text
"đánh dấu lỗi" → action = mark_defective
"nhập kho" → action = stock_in
"bán cho anh Nam" → action = create_sale
```

---

# 8. Skill Architecture

Mỗi skill là một module độc lập.

Skill không gọi database trực tiếp.

Skill chỉ gọi Backend Business API.

```text
Agent
    ↓
Skill
    ↓
Backend API
    ↓
Database Transaction
```

---

## 8.1 Skill Interface

Mỗi skill cần chuẩn input/output.

```ts
interface AgentSkill<Input, Output> {
  name: string
  description: string
  requiredPermissions: string[]
  requiredFields: string[]
  execute(input: Input, context: AgentContext): Promise<SkillResult<Output>>
}
```

Output chuẩn:

```json
{
  "success": true,
  "message": "Đã tạo phiếu mua PO-000123",
  "data": {},
  "requiresConfirmation": false,
  "missingFields": []
}
```

---

# 9. Danh sách Skills

## 9.1 Purchase Skill

Chức năng:

```text
Tạo phiếu mua máy
Tạo phiếu mua linh kiện
Ghi nhận giá mua
Ghi nhận nhà cung cấp
Ghi nhận chi phí
```

Input ví dụ:

```json
{
  "type": "machine",
  "machineModel": "Dell Optiplex 7060",
  "components": [
    {
      "type": "CPU",
      "model": "i5-8500"
    },
    {
      "type": "RAM",
      "size": "8GB",
      "memoryType": "DDR4"
    },
    {
      "type": "SSD",
      "size": "256GB"
    }
  ],
  "purchasePrice": 4800000,
  "supplierName": "Khách lẻ"
}
```

---

## 9.2 Component Skill

Chức năng:

```text
Tạo linh kiện
Cập nhật linh kiện
Tìm linh kiện
Đổi trạng thái linh kiện
Gắn serial
Gắn ảnh
```

---

## 9.3 Inventory Skill

Chức năng:

```text
Kiểm tồn kho
Nhập kho
Xuất kho
Điều chỉnh kho
Chuyển kho
Báo linh kiện lỗi
Thanh lý linh kiện
```

---

## 9.4 Disassembly Skill

Chức năng:

```text
Tháo máy
Sinh linh kiện từ máy mua vào
Phân bổ giá vốn
Nhập kho linh kiện
```

Luồng:

```text
User nói danh sách linh kiện
    ↓
Agent tách linh kiện
    ↓
Agent hỏi giá vốn nếu thiếu
    ↓
Agent đề xuất phân bổ giá vốn
    ↓
User xác nhận
    ↓
Skill gọi API tháo máy
```

---

## 9.5 Assembly Skill

Chức năng:

```text
Tạo phiếu lắp ráp
Tìm linh kiện phù hợp
Reserve linh kiện
Xuất kho linh kiện
Tạo máy thành phẩm
Tính giá vốn
```

---

## 9.6 Sales Skill

Chức năng:

```text
Tạo đơn bán
Bán máy
Bán linh kiện
Tính giá vốn
Tính lãi
Gắn khách hàng
Gắn bảo hành
```

---

## 9.7 Warranty Skill

Chức năng:

```text
Tạo phiếu bảo hành
Tra cứu máy đã bán
Ghi nhận lỗi
Thay linh kiện
Trả máy cho khách
```

---

## 9.8 Report Skill

Chức năng:

```text
Doanh thu hôm nay
Lợi nhuận hôm nay
Tồn kho
Linh kiện sắp hết
Máy chờ test
Đơn bảo hành quá hạn
```

---

## 9.9 Photo Analyze Skill

Chức năng:

```text
Phân tích ảnh máy
Phân tích ảnh linh kiện
Đọc thông tin từ ảnh
Đọc hóa đơn
Gợi ý danh sách linh kiện
```

Input:

```text
Image file
User prompt
Context
```

Output:

```json
{
  "detectedItems": [
    {
      "type": "RAM",
      "brand": "Kingston",
      "size": "8GB",
      "confidence": 0.86
    }
  ],
  "needsUserConfirmation": true
}
```

---

## 9.10 Clarification Skill

Khi thiếu thông tin, agent hỏi lại.

Ví dụ thiếu giá bán:

```text
Agent: Anh bán máy này giá bao nhiêu?
```

Thiếu khách hàng:

```text
Agent: Anh bán cho khách nào? Có cần lưu số điện thoại không?
```

Thiếu serial:

```text
Agent: Linh kiện này có serial không, hay để trống?
```

---

# 10. Clarification Engine

Agent không được đoán những dữ liệu quan trọng.

Các dữ liệu bắt buộc phải hỏi nếu thiếu:

```text
Giá mua
Giá bán
Sản phẩm cần bán
Số lượng
Khách hàng nếu cần bảo hành
Máy cần tháo
Linh kiện cần xuất kho
```

Ví dụ:

```text
User: Bán cái máy Dell này cho khách.
Agent: Anh bán giá bao nhiêu và bảo hành mấy tháng?
```

Agent nên đưa lựa chọn nhanh:

```text
1. Bảo hành 1 tháng
2. Bảo hành 3 tháng
3. Không bảo hành
```

---

# 11. Confirmation Engine

Các hành động nguy hiểm phải xác nhận.

Bắt buộc xác nhận trước khi:

```text
Tạo đơn bán
Tháo máy
Xuất kho
Hủy đơn
Thanh lý linh kiện
Đổi trạng thái lỗi
Thay linh kiện bảo hành
Điều chỉnh tồn kho
```

Ví dụ:

```text
Agent: Tôi sẽ bán PCSALE0001 cho anh Nam với giá 9.500.000đ, bảo hành 3 tháng. Xác nhận không?
```

User nói:

```text
"Xác nhận"
"Đúng rồi"
"Ok làm đi"
```

Thì agent mới chạy skill.

---

# 12. Context Manager

Agent cần nhớ ngữ cảnh trong một phiên làm việc.

Ví dụ:

```text
User: Tôi vừa mua một bộ Dell 7060.
Agent: Giá mua bao nhiêu?
User: 4 triệu 8.
Agent: Trong máy có những linh kiện gì?
User: i5 8500, RAM 8, SSD 256.
```

Context lưu:

```json
{
  "currentIntent": "create_purchase_machine",
  "draftData": {
    "machineModel": "Dell 7060",
    "purchasePrice": 4800000,
    "components": []
  },
  "missingFields": ["components"],
  "status": "collecting_information"
}
```

---

# 13. Agent Session State

Trạng thái session:

```text
IDLE
LISTENING
TRANSCRIBING
UNDERSTANDING
COLLECTING_INFO
WAITING_CONFIRMATION
EXECUTING_SKILL
COMPLETED
FAILED
CANCELLED
```

---

# 14. Agent API Design

Base URL:

```text
/api/v1/agent
```

## Start voice session

```http
POST /agent/sessions
```

Response:

```json
{
  "sessionId": "ags_123",
  "status": "IDLE"
}
```

---

## Upload audio

```http
POST /agent/sessions/{sessionId}/audio
```

Response:

```json
{
  "transcript": "bán máy pc sale 1 cho anh nam giá 9 triệu rưỡi",
  "agentMessage": "Anh muốn bảo hành mấy tháng?",
  "state": "COLLECTING_INFO"
}
```

---

## Send text message

```http
POST /agent/sessions/{sessionId}/messages
```

Request:

```json
{
  "text": "bảo hành 3 tháng"
}
```

---

## Confirm action

```http
POST /agent/sessions/{sessionId}/confirm
```

Request:

```json
{
  "confirm": true
}
```

---

## Cancel session

```http
POST /agent/sessions/{sessionId}/cancel
```

---

# 15. Agent Response Format

Mọi response của agent nên thống nhất.

```json
{
  "sessionId": "ags_123",
  "state": "WAITING_CONFIRMATION",
  "transcript": "bán máy này cho anh Nam giá 9 triệu rưỡi",
  "intent": "sell_finished_pc",
  "confidence": 0.91,
  "agentMessage": "Tôi sẽ bán máy PCSALE0001 cho anh Nam giá 9.500.000đ, bảo hành 3 tháng. Xác nhận không?",
  "draftAction": {
    "skill": "sales.createSale",
    "payload": {}
  },
  "missingFields": [],
  "choices": [
    {
      "label": "Xác nhận",
      "value": "confirm"
    },
    {
      "label": "Sửa lại",
      "value": "edit"
    },
    {
      "label": "Hủy",
      "value": "cancel"
    }
  ]
}
```

---

# 16. Data Model

## agent_sessions

```text
id
user_id
status
current_intent
confidence
created_at
updated_at
completed_at
cancelled_at
```

---

## agent_messages

```text
id
session_id
role
content
audio_url
transcript
created_at
```

---

## agent_actions

```text
id
session_id
skill_name
intent
payload_json
status
requires_confirmation
confirmed_at
executed_at
result_json
error_message
created_at
```

---

## agent_skill_logs

```text
id
action_id
skill_name
request_json
response_json
duration_ms
status
created_at
```

---

## pending_agent_tasks

```text
id
session_id
type
payload_json
missing_fields_json
status
created_at
updated_at
```

---

# 17. Permission Model

Agent phải chạy theo quyền của người dùng.

Ví dụ:

```text
Nhân viên kỹ thuật:
- machine:inspect
- machine:disassemble
- component:view
- assembly:create

Nhân viên bán hàng:
- sale:create
- customer:create
- component:view
- finished_pc:view

Quản lý:
- report:view
- sale:cancel
- stock:adjust
```

Agent không có quyền riêng vượt quá quyền user.

```text
Agent permission = User permission
```

---

# 18. Safety Rules

Agent không được tự thực hiện các thao tác sau nếu chưa xác nhận:

```text
Bán hàng
Xuất kho
Tháo máy
Hủy đơn
Xóa dữ liệu
Thanh lý linh kiện
Điều chỉnh giá vốn
Đổi trạng thái linh kiện sang lỗi
```

Agent được phép tự làm sau khi hiểu rõ:

```text
Tìm kiếm
Tra cứu tồn kho
Tạo nháp phiếu mua
Tạo nháp phiếu bán
Tạo nháp phiếu lắp ráp
```

---

# 19. Human-in-the-loop

Mọi giao dịch quan trọng đều có bước review.

```text
Agent hiểu yêu cầu
    ↓
Agent tạo bản nháp
    ↓
User xem lại
    ↓
User xác nhận
    ↓
Agent thực thi
```

Ví dụ:

```text
Tôi hiểu như sau:

Phiếu mua:
- Dell Optiplex 7060
- CPU i5-8500
- RAM 8GB
- SSD 256GB
- Giá mua: 4.800.000đ

Anh xác nhận tạo phiếu mua không?
```

---

# 20. Voice UX Flow

## Flow 1: Tạo phiếu mua bằng voice

```text
User bấm nút voice
    ↓
User nói:
"Tôi vừa mua một bộ Dell 7060, i5 8500, RAM 8, SSD 256, giá 4 triệu 8"
    ↓
Agent phân tích
    ↓
Agent hiển thị bản nháp
    ↓
User xác nhận
    ↓
Purchase Skill tạo phiếu mua
    ↓
Agent báo:
"Đã tạo phiếu mua PO-000123"
```

---

## Flow 2: Tháo máy bằng voice

```text
User:
"Tháo máy PO-000123 ra, gồm i5 8500, main H370, RAM 8, SSD 256, nguồn Dell"
    ↓
Agent:
"Anh muốn phân bổ giá vốn tự động theo giá thị trường hay nhập tay?"
    ↓
User:
"Tự phân bổ đi"
    ↓
Agent:
"Tổng giá vốn 4.800.000đ. Tôi phân bổ CPU 1.3tr, main 1.1tr, RAM 400k, SSD 600k, nguồn 500k, case 900k. Xác nhận không?"
    ↓
User:
"Đúng rồi"
    ↓
Agent gọi Disassembly Skill
```

---

## Flow 3: Bán hàng bằng voice

```text
User:
"Bán PCSALE0001 cho anh Nam giá 9 triệu rưỡi, bảo hành 3 tháng"
    ↓
Agent:
"Tôi sẽ tạo đơn bán PCSALE0001 cho anh Nam giá 9.500.000đ, bảo hành 3 tháng. Xác nhận không?"
    ↓
User:
"Xác nhận"
    ↓
Agent gọi Sales Skill
```

---

## Flow 4: Hỏi báo cáo

```text
User:
"Hôm nay lãi bao nhiêu?"
    ↓
Agent gọi Report Skill
    ↓
Agent:
"Hôm nay doanh thu 12.500.000đ, giá vốn 9.200.000đ, lợi nhuận 3.300.000đ."
```

---

# 21. Photo + Voice Flow

User có thể vừa chụp ảnh vừa nói.

Ví dụ:

```text
User chụp ảnh mainboard
User nói: "Nhập linh kiện này vào kho, tình trạng tốt"
```

Luồng:

```text
Image
    ↓
Photo Analyze Skill
    ↓
Detect component
    ↓
Voice text bổ sung context
    ↓
Agent tạo draft component
    ↓
User xác nhận
```

---

# 22. Vietnamese Number Parser

Agent cần parse tiền Việt Nam.

Ví dụ:

```text
4 triệu 8 → 4.800.000
9 triệu rưỡi → 9.500.000
ba trăm nghìn → 300.000
ba trăm rưỡi → 350.000
1 củ 2 → 1.200.000
2 chai → 2.000.000
```

Cần có module:

```text
vietnamese-number-parser
```

---

# 23. Product Dictionary

Cần có từ điển linh kiện để agent hiểu nhanh.

Ví dụ:

```text
i5 8500 = Intel Core i5-8500
i7 8700 = Intel Core i7-8700
ram 8 = RAM 8GB
ổ 256 = SSD 256GB
card 1660 = GTX 1660
nguồn 500 = PSU 500W
```

Bảng dữ liệu:

```text
product_aliases
```

```text
id
alias
normalized_name
component_type
metadata_json
```

---

# 24. Confidence Threshold

Agent phải có ngưỡng tin cậy.

```text
confidence >= 0.85
    → Có thể tạo draft

0.60 <= confidence < 0.85
    → Hỏi lại để xác nhận

confidence < 0.60
    → Không thực hiện, yêu cầu nói lại
```

Ví dụ:

```text
Agent: Tôi chưa chắc anh nói là RAM 8GB hay 16GB. Anh xác nhận lại giúp tôi?
```

---

# 25. Skill Selection Logic

```text
Transcript:
"Bán con SSD 256 Kingston cho khách giá 500 nghìn"

Detected:
intent = sell_component

Required skill:
sales.sellComponent

Required fields:
component
sale_price

Missing:
customer optional
warranty optional

Action:
Create confirmation draft
```

---

# 26. Agent Planning

Với tác vụ phức tạp, agent lập kế hoạch nhiều bước.

Ví dụ:

```text
"Lắp cho tôi một cây máy văn phòng tầm 5 triệu"
```

Plan:

```text
1. Tìm CPU phù hợp trong kho
2. Tìm main tương thích
3. Tìm RAM
4. Tìm SSD
5. Tính giá vốn
6. Gợi ý cấu hình
7. Hỏi xác nhận
8. Tạo phiếu lắp ráp
```

---

# 27. Agent Memory

Có 2 loại memory.

## Session Memory

Chỉ nhớ trong phiên hiện tại.

```text
Người dùng đang tạo phiếu mua nào
Đang hỏi thiếu thông tin gì
Draft action hiện tại
```

## Business Memory

Dữ liệu lưu trong database.

```text
Alias linh kiện
Khách quen
Nhà cung cấp quen
Giá bán thường dùng
Cấu hình mẫu
```

---

# 28. Backend Business API Required

Agent cần gọi các API nghiệp vụ sau.

```text
POST /purchases
POST /purchases/:id/items
POST /purchases/:id/confirm

POST /machines/:id/inspect
POST /machines/:id/disassemble

GET /components/search
GET /components/by-code/:code
POST /components
PATCH /components/:id/status

GET /inventory/stock
POST /inventory/transactions

POST /assemblies
POST /assemblies/:id/items
POST /assemblies/:id/complete

POST /sales
POST /sales/:id/confirm
POST /sales/:id/cancel

POST /warranties
PATCH /warranties/:id/status

GET /reports/today
GET /reports/profit
GET /reports/inventory-value
```

---

# 29. Agent Tech Stack

## Mobile App

```text
Kotlin
Jetpack Compose
CameraX
ML Kit Barcode
Audio Recorder
WorkManager
Retrofit
Room
DataStore
```

## Web App

```text
Next.js
React
TypeScript
Web Audio API
MediaRecorder API
TanStack Query
```

## Backend

```text
NestJS
PostgreSQL
Prisma
Redis
BullMQ
WebSocket
Object Storage
```

## AI / Agent

```text
Speech-to-Text
LLM Intent Parser
Tool Calling
Skill Router
Conversation State Machine
Vision Model for photo analysis
```

---

# 30. Real-time Communication

Có thể dùng WebSocket để agent trả tiến trình.

```text
Client
    ↓
POST audio
    ↓
Server xử lý
    ↓
WebSocket event:
        transcribing
        understanding
        need_more_info
        waiting_confirmation
        executing
        completed
```

Events:

```text
agent.transcribing
agent.intent_detected
agent.need_more_info
agent.waiting_confirmation
agent.skill_executing
agent.completed
agent.failed
```

---

# 31. Audit Log

Mọi hành động agent thực hiện phải ghi log.

```text
Ai nói?
Nói gì?
Agent hiểu gì?
Skill nào được gọi?
Payload là gì?
Kết quả ra sao?
Có xác nhận không?
```

Ví dụ:

```text
User: Nguyen Van A
Transcript: "Bán PCSALE0001 giá 9 triệu rưỡi"
Intent: sell_finished_pc
Skill: sales.createSale
Confirmed: true
Result: SO-000123
```

---

# 32. Error Handling

Các lỗi phổ biến:

```text
Không nghe rõ
Không hiểu ý định
Thiếu thông tin
Không có quyền
Linh kiện không tồn tại
Linh kiện không còn trong kho
Máy chưa sẵn sàng bán
Giá không hợp lệ
API lỗi
Mất mạng
```

Ví dụ response:

```text
"Tôi chưa tìm thấy linh kiện RAM000123 trong kho. Anh muốn tìm theo tên hoặc quét mã QR không?"
```

---

# 33. Offline Handling

Nếu mất mạng:

Agent chỉ cho phép:

```text
Ghi nháp phiếu mua
Chụp ảnh
Ghi chú kiểm tra máy
Lưu voice transcript tạm
```

Không cho phép:

```text
Xác nhận bán hàng
Xuất kho
Tháo máy chính thức
Hoàn tất lắp ráp
Điều chỉnh tồn kho
```

Các draft sẽ đồng bộ khi có mạng.

---

# 34. Security

Yêu cầu:

```text
HTTPS bắt buộc
Auth bằng JWT
Refresh token rotation
RBAC
Không log token
Không lưu audio nhạy cảm quá lâu
Audio có thể tự xóa sau 7-30 ngày
Mọi action quan trọng cần xác nhận
Rate limit agent API
Validate payload skill
Không cho LLM gọi API trực tiếp không qua skill router
```

---

# 35. Agent Guardrails

Agent phải tuân thủ:

```text
1. Không tự ý bán hàng nếu chưa xác nhận.
2. Không tự ý xóa dữ liệu.
3. Không sửa giá vốn đã khóa nếu không có quyền.
4. Không xuất kho linh kiện không còn trạng thái IN_STOCK.
5. Không dùng linh kiện đã thuộc về máy khác.
6. Không đoán serial nếu không có.
7. Không tạo khách hàng trùng nếu có số điện thoại giống.
8. Không cho phép giá bán âm hoặc giá mua âm.
```

---

# 36. Database Transaction Boundary

Các skill sau phải chạy trong transaction:

```text
disassemble_machine
complete_assembly
create_sale
cancel_sale
replace_warranty_component
stock_adjustment
```

Ví dụ bán hàng:

```text
BEGIN TRANSACTION

1. Create sales_order
2. Create sales_items
3. Mark finished_pc SOLD
4. Mark all components SOLD
5. Create stock_transactions OUT
6. Create audit_log
7. Create warranty if needed

COMMIT
```

Nếu lỗi:

```text
ROLLBACK
```

---

# 37. Suggested User Interface

## Mobile Main Screen

```text
--------------------------------
PC Refurb Agent
--------------------------------

[🎙 Nhấn để nói]

Hôm nay:
Doanh thu: 12.500.000đ
Lợi nhuận: 3.200.000đ
Máy chờ test: 7
Linh kiện sắp hết: 23

Thao tác nhanh:
[Quét QR]
[Chụp ảnh]
[Nhập máy]
[Bán hàng]
[Kho]
```

---

## Agent Result Card

```text
Tôi hiểu yêu cầu:

Hành động:
Tạo phiếu mua máy cũ

Thông tin:
- Máy: Dell Optiplex 7060
- CPU: i5-8500
- RAM: 8GB
- SSD: 256GB
- Giá mua: 4.800.000đ

[ Xác nhận ] [ Sửa lại ] [ Hủy ]
```

---

# 38. MVP Scope

Phiên bản đầu tiên nên có:

```text
1. Voice button
2. Speech-to-text tiếng Việt
3. Agent session
4. Intent detection
5. Tạo phiếu mua bằng voice
6. Tìm linh kiện bằng voice
7. Kiểm tồn kho bằng voice
8. Bán hàng bằng voice
9. Hỏi báo cáo bằng voice
10. Confirmation trước khi thực thi
```

Chưa nên làm ngay:

```text
Tự động phân tích ảnh phức tạp
Offline bán hàng
AI gợi ý cấu hình nâng cao
Đa agent
Tự động quyết định giá vốn
```

---

# 39. Phase 2

Sau MVP, thêm:

```text
Photo Analyze Skill
QR Scanner Skill
Disassembly Skill nâng cao
Assembly Planning Skill
Warranty Skill
Vietnamese product alias learning
Voice command shortcuts
```

---

# 40. Phase 3

Mở rộng:

```text
Agent tự học từ thao tác thường dùng
Gợi ý giá bán
Gợi ý cấu hình theo tồn kho
Tự động đọc hóa đơn
Tự tạo báo cáo cuối ngày
Nhắc việc linh kiện sắp hết
Tích hợp Telegram bot
```

---

# 41. Telegram Bot Extension

Có thể thêm Telegram bot để thao tác ngoài app.

```text
Telegram Bot
    ↓
Webhook Server
    ↓
Agent Orchestrator
    ↓
Skill Router
    ↓
Business API
```

Ví dụ:

```text
User gửi voice trên Telegram:
"Hôm nay lãi bao nhiêu?"
```

Bot trả:

```text
"Hôm nay doanh thu 12.500.000đ, lợi nhuận 3.200.000đ."
```

---

# 42. MCP / Tool Server Extension

Có thể thiết kế MCP server để agent gọi tool chuẩn hóa.

```text
Agent
    ↓
MCP Tool Server
    ├── purchase.create
    ├── component.search
    ├── inventory.check
    ├── sale.create
    ├── warranty.create
    └── report.today
```

Ưu điểm:

```text
Dễ mở rộng skill
Tách agent khỏi business logic
Dễ tích hợp nhiều client
Có thể dùng với nhiều AI model
```

---

# 43. Success Criteria

Chức năng agent được coi là thành công nếu:

```text
Người dùng có thể tạo phiếu mua bằng giọng nói
Người dùng có thể bán hàng bằng giọng nói
Người dùng có thể kiểm kho bằng giọng nói
Agent biết hỏi lại khi thiếu thông tin
Agent không làm sai tồn kho
Agent luôn yêu cầu xác nhận trước hành động nguy hiểm
Mọi hành động đều có audit log
```

---

# 44. Kết luận

Chức năng voice agent nên là trung tâm của sản phẩm.

Thay vì bắt người dùng nhập form, hệ thống nên hoạt động theo mô hình:

```text
Nói tự nhiên
    ↓
Agent hiểu nghiệp vụ
    ↓
Agent hỏi lại nếu thiếu
    ↓
Agent gọi skill
    ↓
User xác nhận
    ↓
Hệ thống cập nhật dữ liệu
```

Kiến trúc cốt lõi:

```text
Voice UI
+
Speech-to-Text
+
Agent Orchestrator
+
Skill Router
+
Business API
+
Audit Log
```

Điểm quan trọng nhất:

```text
Agent không được sửa dữ liệu trực tiếp.
Agent chỉ được gọi skill.
Skill chỉ được gọi Business API.
Business API mới được thay đổi database bằng transaction.
```

Như vậy hệ thống vừa thông minh, vừa an toàn, vừa phù hợp với thực tế cửa hàng bận rộn và không muốn nhập tay thủ công.
