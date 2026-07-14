Để được gọi là một application xuất sắc, app không chỉ cần “có đủ chức năng”, mà phải đồng thời đạt được 4 mục tiêu:

Giải quyết đúng vấn đề của người dùng
Hoạt động ổn định và có thể phục hồi khi gặp lỗi
Dễ sử dụng, dễ bảo trì, dễ mở rộng
Tạo ra giá trị đo lường được cho người dùng hoặc doanh nghiệp

Trong đó, nếu ưu tiên số một của bạn là độ ổn định, toàn bộ quy trình phát triển phải được thiết kế theo hướng: hạn chế lỗi từ đầu, phát hiện lỗi sớm, cô lập lỗi, phục hồi nhanh và luôn có khả năng quay về phiên bản an toàn.

1. Các nhóm KPI để đánh giá một app xuất sắc
1.1. KPI về giá trị sản phẩm

App phải giải quyết được một vấn đề thực tế, không chỉ có nhiều tính năng.

Các chỉ số quan trọng:

KPI	Ý nghĩa
Task success rate	Tỷ lệ người dùng hoàn thành được công việc chính
Time to value	Thời gian từ lúc mở app đến khi nhận được giá trị đầu tiên
Feature adoption	Tỷ lệ người dùng thực sự sử dụng từng tính năng
Retention	Người dùng có quay lại sử dụng hay không
Churn rate	Tỷ lệ người dùng ngừng sử dụng
Conversion rate	Tỷ lệ hoàn thành hành động mục tiêu
User satisfaction	Mức hài lòng của người dùng
Problem resolution rate	Tỷ lệ vấn đề được app xử lý thành công

Ví dụ, với app tạo website tự động:

KPI chính không phải là “đã tạo được HTML”.
KPI đúng phải là:
Website tạo thành công bao nhiêu phần trăm.
Giao diện giống bản gốc bao nhiêu phần trăm.
Có lỗi responsive hay không.
Có import được vào Bricks Builder hay không.
Người dùng có phải sửa tay nhiều hay không.

Một tính năng chỉ được xem là thành công khi người dùng hoàn thành được mục tiêu cuối cùng.

2. KPI về độ ổn định

Đây là nhóm KPI quan trọng nhất với yêu cầu của bạn.

2.1. Availability

Availability là tỷ lệ thời gian hệ thống có thể sử dụng được.

Công thức:

Availability = Uptime / Tổng thời gian

Mức tham khảo:

Availability	Thời gian ngừng tối đa mỗi tháng
99%	khoảng 7 giờ 18 phút
99.9%	khoảng 43 phút
99.95%	khoảng 22 phút
99.99%	khoảng 4 phút 23 giây

Với app nội bộ nhỏ, có thể đặt mục tiêu 99.5–99.9%.

Với SaaS thương mại, hệ thống thanh toán hoặc app phục vụ khách hàng liên tục, nên hướng đến 99.9% trở lên.

2.2. Crash-free rate

Tỷ lệ phiên sử dụng không bị crash.

Mục tiêu đề xuất:

Crash-free sessions ≥ 99.5%
Crash-free users ≥ 99.5%

Với app quan trọng:

Crash-free sessions ≥ 99.9%
2.3. Error rate

Tỷ lệ request hoặc tác vụ bị lỗi.

Error rate = Số request lỗi / Tổng số request

Mục tiêu thường gặp:

API thông thường: dưới 1%
API quan trọng: dưới 0.1%
Thanh toán, xác thực, lưu dữ liệu: càng gần 0% càng tốt

Không được chỉ tính lỗi HTTP 500. Cần tính cả:

Timeout
Request thất bại
Dữ liệu sai
Tác vụ bị treo
Lỗi từ dịch vụ bên thứ ba
Job chạy nền thất bại
Kết quả không đúng dù API trả về 200
2.4. Latency

Thời gian phản hồi của hệ thống.

Không nên chỉ theo dõi giá trị trung bình. Phải theo dõi:

P50: 50% request nhanh hơn mức này
P95: 95% request nhanh hơn mức này
P99: 99% request nhanh hơn mức này

Ví dụ:

P50 < 200 ms
P95 < 800 ms
P99 < 2 giây

Với tác vụ AI, xử lý video hoặc sinh website, thời gian có thể dài hơn. Khi đó app cần:

Hiển thị tiến độ
Không làm giao diện bị treo
Cho phép retry
Cho phép tiếp tục từ bước bị lỗi
Lưu trạng thái công việc
2.5. MTTR

Mean Time to Recovery là thời gian trung bình để khôi phục hệ thống sau sự cố.

MTTR = Tổng thời gian khắc phục / Số sự cố

Một app ổn định không phải là app không bao giờ lỗi. Đó là app:

Biết lỗi ở đâu
Cảnh báo nhanh
Không làm mất dữ liệu
Phục hồi nhanh
Có thể rollback

Mục tiêu thực tế:

Sự cố nhẹ: dưới 15–30 phút
Sự cố nghiêm trọng: dưới 1 giờ
Lỗi không thể khắc phục ngay: rollback trong vài phút
2.6. MTBF

Mean Time Between Failures là khoảng thời gian trung bình giữa hai lần hệ thống gặp sự cố.

MTBF càng dài thì hệ thống càng ổn định.

2.7. Data integrity

Hệ thống không được:

Mất dữ liệu
Ghi trùng dữ liệu
Ghi sai dữ liệu
Dữ liệu giữa các dịch vụ không đồng nhất
Trạng thái hiển thị khác với trạng thái thực tế

Các KPI nên có:

Data loss rate = 0%
Duplicate transaction rate ≈ 0%
Backup success rate = 100%
Restore test success rate = 100%
3. KPI về trải nghiệm người dùng

Một app kỹ thuật tốt nhưng khó sử dụng vẫn chưa phải app xuất sắc.

3.1. Usability

Cần đo:

Người mới có hiểu cách sử dụng không.
Có hoàn thành tác vụ mà không cần hướng dẫn không.
Có bị lạc trong giao diện không.
Có biết hệ thống đang xử lý hay đã bị treo không.
Khi xảy ra lỗi, thông báo có giúp họ sửa được không.

KPI tham khảo:

Task completion rate ≥ 90%
Critical task completion rate ≥ 98%
First-time success rate ≥ 80%
3.2. Accessibility

App nên đáp ứng các nguyên tắc:

Có thể sử dụng bằng bàn phím
Có focus state rõ ràng
Độ tương phản đủ
Không chỉ dùng màu sắc để truyền đạt trạng thái
Form có label
Hình ảnh có mô tả phù hợp
Nội dung có thể đọc bằng screen reader
Font không quá nhỏ
Nút bấm đủ lớn trên mobile
3.3. Responsive

Cần kiểm tra trên:

Desktop
Laptop
Tablet
Mobile
Màn hình nhỏ
Màn hình siêu rộng
Trình duyệt khác nhau

Không chỉ kiểm tra “có co lại được hay không”, mà phải kiểm tra:

Nội dung có bị tràn không
Modal có bị khuất không
Bàn phím mobile có che input không
Nút có đủ lớn không
Bảng dữ liệu có cách hiển thị hợp lý không
4. KPI về bảo mật

Bảo mật không phải bước kiểm tra cuối cùng. Nó phải nằm trong toàn bộ vòng đời phát triển.

App cần đảm bảo:

4.1. Authentication
Mật khẩu được hash đúng cách
Có giới hạn số lần đăng nhập sai
Có MFA nếu cần
Token có thời hạn
Refresh token được bảo vệ
Có đăng xuất khỏi tất cả thiết bị
Không để lộ session
4.2. Authorization

Authentication trả lời câu hỏi “bạn là ai”.

Authorization trả lời câu hỏi “bạn được phép làm gì”.

Phải kiểm tra quyền ở backend, không chỉ ẩn nút ở frontend.

Ví dụ:

User không được xem dữ liệu của user khác.
Nhân viên không được truy cập chức năng admin.
Người dùng không thể sửa ID trên URL để truy cập tài nguyên khác.
4.3. Bảo vệ dữ liệu
HTTPS
Mã hóa dữ liệu nhạy cảm
Không lưu mật khẩu dạng plaintext
Không ghi token, mật khẩu, API key vào log
Không commit secret lên GitHub
Phân quyền database
Có chính sách lưu và xóa dữ liệu
4.4. Bảo vệ API
Rate limiting
Input validation
Schema validation
Chống SQL injection
Chống XSS
Chống CSRF
Chống file upload độc hại
Giới hạn kích thước request
Timeout
Kiểm tra chữ ký webhook
Idempotency với tác vụ quan trọng
5. KPI về khả năng bảo trì

Một app ban đầu chạy tốt nhưng sửa một tính năng làm hỏng ba tính năng khác thì chưa ổn định.

Cần đánh giá:

Code có module rõ ràng không.
Có test hay không.
Có tài liệu hay không.
Developer mới có hiểu hệ thống không.
Có thể thay đổi dịch vụ bên thứ ba không.
Có thể rollback không.
Có phụ thuộc quá nhiều vào một người không.

Các chỉ số có thể theo dõi:

KPI	Mục tiêu
Test coverage	Không nên dùng một mình, tập trung phần quan trọng
Build success rate	Trên 95–98%
Deployment failure rate	Dưới 5%
Change failure rate	Càng thấp càng tốt
Mean review time	Không để PR tồn quá lâu
Technical debt	Có danh sách và kế hoạch xử lý
Documentation coverage	Các module chính đều có tài liệu

Test coverage 90% không đảm bảo phần mềm tốt. Quan trọng hơn là test có đúng tình huống nguy hiểm hay không.

6. Tiêu chuẩn hoàn chỉnh cho một tính năng

Một tính năng không được xem là hoàn thành chỉ vì “đã code xong”.

Definition of Done nên bao gồm:

Có yêu cầu rõ ràng
Có acceptance criteria
UI hoàn chỉnh
Backend hoàn chỉnh
Có validation
Có xử lý lỗi
Có loading state
Có empty state
Có permission
Có log
Có metric
Có test
Có tài liệu
Đã review code
Đã kiểm tra responsive
Đã kiểm tra bảo mật
Đã kiểm tra trên staging
Có rollback plan
Đã được Product Owner hoặc người chịu trách nhiệm nghiệm thu

Ví dụ với tính năng upload file, không được chỉ kiểm tra “upload thành công”.

Cần kiểm tra thêm:

File quá lớn
Sai định dạng
File hỏng
Trùng tên
Mất mạng giữa chừng
Người dùng bấm upload nhiều lần
Upload thành công nhưng lưu database thất bại
Lưu database thành công nhưng lưu file thất bại
File chứa nội dung nguy hiểm
Người dùng không có quyền
Hết dung lượng lưu trữ
Dịch vụ lưu trữ bị timeout
7. Quy trình hoàn chỉnh để tạo một application
Giai đoạn 1: Xác định vấn đề

Trước khi chọn công nghệ, phải trả lời:

App dành cho ai?
Người dùng đang gặp vấn đề gì?
Hiện tại họ giải quyết bằng cách nào?
Vì sao giải pháp hiện tại chưa tốt?
App tạo ra giá trị gì?
Hành động quan trọng nhất trong app là gì?
Điều gì xảy ra nếu app thất bại?
Dữ liệu nào là quan trọng nhất?
App phải hoạt động liên tục hay chỉ dùng thỉnh thoảng?

Nên viết Problem Statement:

Đối tượng người dùng:
Vấn đề hiện tại:
Nguyên nhân:
Hậu quả:
Giải pháp đề xuất:
Giá trị mong muốn:
Cách đo thành công:

Ví dụ:

Đối tượng: Người dùng Bricks Builder không biết code.

Vấn đề: Mất nhiều thời gian để sao chép website từ URL sang Bricks JSON.

Giải pháp: Hệ thống tự phân tích URL, ảnh chụp, HTML, CSS và tạo Bricks JSON.

KPI:
- Tỷ lệ import thành công ≥ 98%
- Visual similarity ≥ 90%
- Responsive error rate < 2%
- Tỷ lệ job thất bại < 1%
- Không mất dữ liệu khi job bị gián đoạn
Giai đoạn 2: Xác định phạm vi

Phân chia thành ba nhóm:

Must have

Không có thì app không có giá trị.

Should have

Quan trọng nhưng có thể bổ sung sau.

Nice to have

Có thì tốt nhưng không nên làm chậm phiên bản đầu.

Ví dụ:

Must have:
- Đăng nhập
- Tạo project
- Nhập URL
- Phân tích website
- Sinh kết quả
- Tải hoặc export kết quả
- Lưu trạng thái job
- Retry khi lỗi

Should have:
- Lịch sử phiên bản
- So sánh visual
- Cộng tác nhóm
- Báo cáo lỗi chi tiết

Nice to have:
- Template marketplace
- AI chat assistant
- Auto optimization

Đừng cố xây tất cả trong phiên bản đầu. App ổn định với 5 chức năng tốt hơn app có 30 chức năng nhưng thường xuyên lỗi.

Giai đoạn 3: Xây dựng user flow

Mỗi chức năng phải có luồng rõ ràng:

Người dùng bắt đầu ở đâu?
Họ nhập gì?
Hệ thống kiểm tra gì?
Hệ thống xử lý gì?
Nếu thành công thì sao?
Nếu thất bại thì sao?
Có thể thử lại không?
Dữ liệu có được lưu không?

Một flow tốt phải có:

Happy path
Alternative path
Error path
Permission path
Recovery path

Ví dụ:

Tạo project
→ Nhập URL
→ Kiểm tra URL
→ Tạo job
→ Phân tích
→ Lưu từng bước
→ Sinh kết quả
→ Kiểm tra kết quả
→ Hiển thị preview
→ Export

Error path:

Website chặn crawler
→ Chuyển sang browser automation
→ Nếu vẫn lỗi, yêu cầu người dùng cung cấp file hoặc ảnh
→ Lưu trạng thái lỗi
→ Cho phép retry từ bước phân tích
Giai đoạn 4: Viết yêu cầu chức năng

Mỗi chức năng nên có dạng User Story:

Là một [loại người dùng],
tôi muốn [thực hiện hành động],
để [nhận được giá trị].

Ví dụ:

Là một người dùng,
tôi muốn hệ thống lưu tiến độ phân tích,
để khi mất mạng tôi không phải chạy lại từ đầu.

Acceptance criteria:

Given: Một job đã hoàn thành 3/5 bước
When: Server bị restart
Then: Job tiếp tục từ bước thứ 4
And: Không tạo dữ liệu trùng
And: Người dùng nhìn thấy trạng thái chính xác

Acceptance criteria càng rõ thì chất lượng kiểm thử càng cao.

Giai đoạn 5: Viết yêu cầu phi chức năng

Đây là phần thường bị bỏ qua nhưng quyết định độ ổn định.

Cần xác định:

Performance
Bao nhiêu người dùng đồng thời?
Bao nhiêu request mỗi giây?
Thời gian phản hồi tối đa?
Kích thước file tối đa?
Một tác vụ nền kéo dài bao lâu?
Reliability
Uptime mục tiêu?
Có cần high availability không?
Có thể mất bao nhiêu dữ liệu?
Phục hồi trong bao lâu?
Security
Dữ liệu nào nhạy cảm?
Phân quyền như thế nào?
Có cần audit log không?
Scalability
Dự kiến user trong 6 tháng, 1 năm, 3 năm?
Có tăng tải đột biến không?
Thành phần nào nặng nhất?
Compatibility
Trình duyệt nào?
Hệ điều hành nào?
Mobile hay desktop?
API version nào?
Giai đoạn 6: Thiết kế kiến trúc

Không nên chọn kiến trúc phức tạp chỉ vì nó hiện đại.

Lựa chọn cho MVP hoặc app nhỏ
Frontend
→ Backend monolith
→ PostgreSQL
→ Redis
→ Object Storage
→ Background Worker

Đây thường là lựa chọn tốt nhất vì:

Dễ phát triển
Dễ debug
Dễ deploy
Chi phí thấp
Ít điểm lỗi
Dễ backup
Khi app lớn hơn

Có thể tách:

API Service
Authentication Service
Job Service
Notification Service
File Service
AI Processing Service

Chỉ nên dùng microservices khi thực sự có:

Nhiều team độc lập
Mỗi module có tải rất khác nhau
Cần deploy độc lập
Có yêu cầu cô lập lỗi
Monolith bắt đầu gây cản trở rõ ràng

Microservices không tự động làm hệ thống ổn định hơn. Nó có thể làm tăng:

Network failure
Timeout
Dữ liệu không đồng nhất
Độ khó theo dõi lỗi
Chi phí vận hành
Giai đoạn 7: Thiết kế dữ liệu

Cần xác định:

Entity nào tồn tại?
Quan hệ giữa các entity?
Dữ liệu nào bắt buộc?
Dữ liệu nào có thể null?
Dữ liệu nào không được trùng?
Trạng thái nào hợp lệ?
Khi xóa user thì dữ liệu xử lý thế nào?

Ví dụ state machine cho job:

pending
→ validating
→ queued
→ processing
→ validating_result
→ completed

Trạng thái lỗi:

failed_retryable
failed_permanent
cancelled
timeout

Không nên chỉ có:

success
failed

Vì sẽ không biết job đang ở bước nào, có thể retry hay không.

Cần có:

Primary key
Unique constraint
Foreign key
Index
Created time
Updated time
Version
Audit fields nếu cần
Giai đoạn 8: Thiết kế API

Một API tốt cần:

Tên endpoint rõ ràng
Request schema
Response schema
Validation
Authentication
Authorization
Error code
Pagination
Rate limiting
Versioning
Idempotency
Timeout
Logging

Ví dụ response lỗi tốt:

{
  "error": {
    "code": "PROJECT_URL_UNREACHABLE",
    "message": "Không thể truy cập URL đã cung cấp.",
    "retryable": true,
    "request_id": "req_abc123"
  }
}

Không nên chỉ trả:

{
  "error": "Something went wrong"
}

request_id rất quan trọng để truy tìm log.

Giai đoạn 9: Thiết kế khả năng chống lỗi

Đây là phần cốt lõi của app ổn định.

Timeout

Mọi request ra bên ngoài đều phải có timeout.

Không được để hệ thống chờ vô hạn.

Retry

Chỉ retry với lỗi có khả năng phục hồi:

Timeout
Mạng tạm thời lỗi
Dịch vụ trả 429
Dịch vụ trả 502, 503

Không retry vô hạn.

Nên dùng exponential backoff:

1 giây
2 giây
4 giây
8 giây
Circuit breaker

Nếu dịch vụ bên thứ ba đang lỗi liên tục, tạm thời ngừng gọi dịch vụ đó để tránh kéo sập toàn hệ thống.

Idempotency

Khi người dùng bấm nút hai lần hoặc request bị gửi lại, hệ thống không được tạo hai giao dịch.

Đặc biệt cần cho:

Thanh toán
Tạo đơn hàng
Gửi email
Tạo job
Webhook
Trừ credit
Queue

Các tác vụ nặng nên chạy qua queue:

Gửi email
Xử lý video
Phân tích website
Gọi AI
Export file
Crawl dữ liệu

Queue giúp:

Không làm API bị treo
Retry được
Giới hạn concurrency
Lưu trạng thái
Theo dõi job
Tách tải nặng khỏi request chính
Graceful degradation

Nếu một module lỗi, app vẫn nên hoạt động ở mức cơ bản.

Ví dụ:

Dịch vụ analytics lỗi nhưng người dùng vẫn đăng nhập được.
Hệ thống gửi email lỗi nhưng đơn hàng vẫn được lưu.
AI suggestion lỗi nhưng người dùng vẫn sửa nội dung thủ công.
Preview lỗi nhưng file gốc vẫn có thể tải xuống.
Giai đoạn 10: Lập trình

Nên thiết lập tiêu chuẩn code ngay từ đầu:

Coding convention
Formatter
Linter
Type checking
Branch strategy
Pull request
Code review
Commit convention
Secret management
Environment separation

Các môi trường cần có:

Local
Development
Testing
Staging
Production

Không được thử nghiệm trực tiếp trên production.

Các quy tắc quan trọng:

Không hard-code secret
Không hard-code URL môi trường
Không dùng tài khoản production để test
Không dùng database production cho local
Không sửa database thủ công nếu không có ghi nhận
Mọi migration phải có version
Giai đoạn 11: Kiểm thử
Unit test

Kiểm tra từng hàm hoặc module nhỏ.

Ví dụ:

Tính giá
Validate email
Chuyển trạng thái
Kiểm tra permission
Xử lý dữ liệu
Integration test

Kiểm tra các thành phần phối hợp:

API với database
Worker với queue
App với storage
Backend với dịch vụ AI
Webhook với database
End-to-end test

Kiểm tra luồng người dùng thực tế:

Đăng ký
→ Đăng nhập
→ Tạo project
→ Chạy job
→ Xem kết quả
→ Export
Contract test

Đảm bảo API giữa các service không bị thay đổi ngoài dự kiến.

Load test

Kiểm tra khi nhiều người dùng cùng lúc.

Cần thử:

Tải bình thường
Tải cao điểm
Tải tăng đột ngột
Chạy lâu
Vượt giới hạn
Failure test

Chủ động làm hỏng từng thành phần:

Database chậm
Redis mất kết nối
API bên thứ ba timeout
Storage lỗi
Worker restart
Queue đầy
Server hết RAM
Disk đầy
Mất mạng
Deploy giữa lúc job đang chạy

Mục tiêu không phải chứng minh hệ thống không lỗi, mà chứng minh hệ thống phản ứng đúng khi lỗi.

Security test
Permission bypass
IDOR
SQL injection
XSS
CSRF
Upload file
Brute force
Token reuse
Rate limit
Secret leakage
Giai đoạn 12: CI/CD

Mỗi lần code được push, pipeline nên tự động chạy:

Install dependencies
→ Lint
→ Type check
→ Unit test
→ Integration test
→ Security scan
→ Build
→ Deploy staging
→ Smoke test
→ Approve
→ Deploy production

Production deployment nên có:

Rolling deployment
Blue-green deployment
Canary deployment
Health check
Automatic rollback

Không nên deploy toàn bộ hệ thống ngay lập tức nếu phiên bản mới chưa được kiểm chứng.

Giai đoạn 13: Observability

Một app không có monitoring sẽ rất khó ổn định.

Cần ba nhóm chính:

Logs

Log phải trả lời được:

Ai thực hiện?
Thực hiện lúc nào?
Request nào?
Tác vụ nào?
Ở module nào?
Lỗi gì?
Dữ liệu trạng thái nào?

Không log:

Mật khẩu
Token
API key
Thông tin thẻ
Dữ liệu cá nhân không cần thiết
Metrics

Theo dõi:

Request count
Error rate
Latency
CPU
RAM
Disk
Queue length
Job failure
Database connections
Cache hit rate
Active users
Conversion
External API failure
Tracing

Tracing dùng để theo dõi một request đi qua nhiều thành phần.

Ví dụ:

Frontend
→ API
→ Database
→ Queue
→ Worker
→ AI API
→ Storage

Nếu tác vụ mất 20 giây, tracing giúp biết 18 giây bị chậm ở đâu.

Giai đoạn 14: Cảnh báo

Alert không nên gửi cho mọi lỗi nhỏ.

Chỉ cảnh báo khi cần hành động:

Error rate tăng đột biến
P95 latency vượt ngưỡng
Database hết connection
Queue backlog quá lớn
Worker không hoạt động
Disk gần đầy
Backup thất bại
Payment failure tăng
Login failure bất thường
Uptime giảm

Mỗi alert cần có:

Mức độ nghiêm trọng
Service bị ảnh hưởng
Metric hiện tại
Ngưỡng
Link log hoặc dashboard
Runbook xử lý
Giai đoạn 15: Backup và phục hồi

Backup chỉ có ý nghĩa khi restore được.

Cần xác định:

RPO

Recovery Point Objective: Có thể chấp nhận mất tối đa bao nhiêu dữ liệu?

Ví dụ:

RPO 24 giờ: có thể mất dữ liệu trong 24 giờ.
RPO 5 phút: chỉ được mất tối đa 5 phút dữ liệu.
RPO 0: không chấp nhận mất dữ liệu.
RTO

Recovery Time Objective: Hệ thống phải phục hồi trong bao lâu?

Ví dụ:

RTO 4 giờ
RTO 1 giờ
RTO 15 phút

Cần có:

Backup database
Backup object storage
Backup configuration
Backup encryption key phù hợp
Lưu ở khu vực khác
Kiểm tra restore định kỳ
Tài liệu disaster recovery
Giai đoạn 16: Phát hành production

Trước khi release cần checklist:

Test đã pass
Migration đã kiểm tra
Backup đã có
Rollback đã chuẩn bị
Dashboard đã hoạt động
Alert đã cấu hình
Runbook đã có
Feature flag đã sẵn sàng
Người chịu trách nhiệm đã xác định
Third-party quota đã kiểm tra
Security review đã hoàn thành
Changelog đã viết

Nên phát hành theo từng bước:

Internal users
→ 5% users
→ 20% users
→ 50% users
→ 100% users

Nếu metric xấu, dừng hoặc rollback.

Giai đoạn 17: Vận hành sau khi ra mắt

Cần theo dõi:

Người dùng có sử dụng đúng flow không.
Tính năng nào không được dùng.
Lỗi tập trung ở đâu.
Người dùng bỏ cuộc tại bước nào.
Chi phí hạ tầng trên mỗi user.
Dịch vụ bên thứ ba nào không ổn định.
Phản hồi nào xuất hiện lặp lại.

Mỗi tuần hoặc mỗi sprint nên xem:

Reliability
Performance
Security
User behavior
Business KPI
Technical debt
Incident
Cost
8. Quy trình xử lý sự cố

Khi có sự cố:

Bước 1: Phát hiện

Monitoring hoặc người dùng báo lỗi.

Bước 2: Phân loại mức độ

Ví dụ:

SEV-1: Toàn hệ thống ngừng hoạt động, mất dữ liệu, lỗi thanh toán lớn
SEV-2: Chức năng chính bị ảnh hưởng
SEV-3: Một nhóm người dùng bị ảnh hưởng
SEV-4: Lỗi nhỏ, có cách xử lý tạm thời
Bước 3: Giảm thiệt hại
Rollback
Tắt feature bằng feature flag
Chuyển sang service dự phòng
Giảm tải
Tạm dừng job
Chuyển hệ thống sang read-only
Bước 4: Khắc phục

Tìm nguyên nhân và sửa lỗi.

Bước 5: Xác minh

Kiểm tra:

Metric đã trở lại bình thường
Dữ liệu có bị ảnh hưởng không
Job thất bại có cần chạy lại không
Người dùng có cần thông báo không
Bước 6: Postmortem

Không chỉ hỏi “ai làm sai”.

Phải hỏi:

Vì sao lỗi có thể xảy ra?
Vì sao test không phát hiện?
Vì sao monitoring không cảnh báo sớm?
Vì sao lỗi lan rộng?
Vì sao phục hồi chậm?
Hệ thống cần thay đổi gì?
9. Các tài liệu một app hoàn chỉnh nên có

Ít nhất nên có:

README.md
Product Requirements Document
Architecture.md
Database schema
API documentation
Environment setup
Deployment guide
Testing strategy
Security checklist
Monitoring guide
Incident response runbook
Backup and restore guide
Changelog
Known limitations

Với dự án AI hoặc automation, nên bổ sung:

Prompt specification
Model configuration
Input/output schema
Fallback strategy
Evaluation dataset
Evaluation metrics
Cost control
Model version tracking
Human review rules
10. Các yếu tố đặc biệt đối với app sử dụng AI

App AI không được chỉ đánh giá bằng uptime.

Cần thêm KPI:

Output validity rate
Hallucination rate
Schema compliance rate
Task completion rate
Cost per task
Average generation time
Retry rate
Human correction rate
Safety violation rate
Model fallback rate

Nên thiết kế:

Input validation
→ Context preparation
→ Model call
→ Output schema validation
→ Rule-based validation
→ Retry hoặc fallback
→ Human review nếu cần
→ Lưu kết quả và phiên bản model

Không nên tin hoàn toàn kết quả AI.

Phải có:

JSON schema
Validator
Rule checker
Retry giới hạn
Model fallback
Kết quả mặc định
Human approval với tác vụ quan trọng
11. Kiến trúc đề xuất cho phần lớn application hiện đại

Với app web có AI, automation hoặc job nền, cấu trúc thực tế có thể là:

Frontend:
Next.js hoặc React

Backend:
FastAPI, NestJS hoặc Django

Database:
PostgreSQL

Cache:
Redis

Queue:
Celery, BullMQ hoặc tương đương

Storage:
S3-compatible object storage

Authentication:
Managed authentication hoặc module auth chuẩn hóa

Monitoring:
Error tracking + metrics + logs + tracing

Deployment:
Docker + CI/CD

Infrastructure:
Cloud managed services trước, Kubernetes sau nếu thực sự cần
Phương án MVP
Next.js
FastAPI hoặc NestJS
PostgreSQL
Redis
Một worker
Docker
Managed cloud

Ưu điểm:

Nhanh
Dễ bảo trì
Ít thành phần
Dễ tìm developer
Đủ khả năng mở rộng giai đoạn đầu
Phương án dài hạn
Frontend riêng
API service
Worker service
PostgreSQL managed
Redis managed
Message queue
Object storage
Centralized logging
Tracing
Auto scaling
Multi-environment CI/CD

Không cần xây hệ thống dài hạn ngay từ ngày đầu. Nhưng thiết kế dữ liệu và module nên đủ sạch để tách ra sau này.

12. Bộ tiêu chuẩn tối thiểu trước khi gọi app là “ổn định”

App chỉ nên được xem là ổn định khi đạt tối thiểu:

Sản phẩm
Chức năng chính giải quyết được vấn đề
Luồng chính rõ ràng
Có đo lường hành vi người dùng
Có acceptance criteria
Kỹ thuật
Không có lỗi nghiêm trọng chưa xử lý
Có timeout, retry và error handling
Có validation frontend và backend
Có queue cho tác vụ nặng
Có transaction cho dữ liệu quan trọng
Có idempotency cho tác vụ dễ bị gửi lặp
Có migration database
Có staging
Có rollback
Kiểm thử
Có unit test cho logic quan trọng
Có integration test
Có end-to-end test cho luồng chính
Có load test
Có failure test
Có security test
Vận hành
Có log
Có metric
Có alert
Có dashboard
Có backup
Đã thử restore
Có incident process
Có người chịu trách nhiệm
Bảo mật
Có authentication
Có authorization
Không lộ secret
Có input validation
Có rate limiting
Có audit log nếu cần
13. Lộ trình triển khai đề xuất
Giai đoạn A: Discovery

Đầu ra:

Problem statement
User persona
User journey
KPI
Phạm vi MVP
Rủi ro
Giai đoạn B: Product design

Đầu ra:

User flow
Wireframe
Prototype
Acceptance criteria
Edge cases
Giai đoạn C: Technical design

Đầu ra:

Architecture
Database schema
API specification
Security model
Reliability strategy
Deployment plan
Giai đoạn D: Development

Đầu ra:

Frontend
Backend
Database
Worker
Tests
Documentation
Giai đoạn E: Verification

Đầu ra:

Functional test
Load test
Security test
Failure test
User acceptance test
Giai đoạn F: Release

Đầu ra:

Staging approval
Backup
Rollback plan
Monitoring
Canary release
Production release
Giai đoạn G: Operation

Đầu ra:

KPI dashboard
Incident review
User feedback
Optimization backlog
Technical debt plan
14. Nguyên tắc quan trọng nhất

Để tạo app xuất sắc và ổn định, hãy tuân theo các nguyên tắc sau:

Xây đúng vấn đề trước khi xây đúng công nghệ.
Giảm số lượng thành phần để giảm điểm lỗi.
Mọi thao tác bên ngoài đều phải có timeout.
Mọi tác vụ quan trọng đều phải có khả năng retry an toàn.
Không được dựa vào AI hoặc dịch vụ bên thứ ba mà không có fallback.
Mọi dữ liệu quan trọng đều phải có backup và kiểm tra restore.
Mọi release đều phải rollback được.
Mọi lỗi đều phải có log, metric và request ID.
Không đo giá trị trung bình khi P95 và P99 đang rất chậm.
Không gọi một tính năng là hoàn thành khi chưa kiểm tra error path.
Không tối ưu mở rộng quá sớm, nhưng cũng không viết code không thể bảo trì.
Độ ổn định là kết quả của quy trình, không phải một tính năng riêng lẻ.

Công thức tổng quát có thể hiểu như sau:

App xuất sắc
=
Đúng vấn đề
× Dễ sử dụng
× Ổn định
× Bảo mật
× Có thể bảo trì
× Đo lường được
× Phục hồi được

Chỉ cần một yếu tố gần bằng 0, chất lượng tổng thể của app sẽ giảm mạnh.