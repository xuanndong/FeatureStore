# Aether Feature Store - Tài liệu đặc tả chức năng

---

### 1. Tổng quan hệ thống
> Aether là nền tảng quản lý đặc trưng (Features) tập trung, cho phép biến đổi dữ liệu thô từ nhiều nguồn thành các tập dữ liệu chuẩn hóa, sẵn sàng phục vụ việc huấn luyện và dự đoán của các mô hình trí tuệ nhân tạo (AI/ML).

---

### 2. Module: Quản lý hạ tầng (Registry)
**2.1. Định nghĩa thực thể (Entities)**
- Mục tiêu: Tạo ra các đối tượng logic cốt lõi để theo dõi dữ liệu (ví dụ: khách hàng, sản phẩm, giao dịch).
- Chức năng chính: Khai báo tên thực thể và khóa liên kết (join key)
- Quản lý danh mục các đối tượng mà hệ thống AI sẽ hướng tới

**2.2. Kết nối nguồn dữ liệu (Data Sources)**
- Mục tiêu: Thiết lập "đường ống" dẫn dữ liệu thô vào hệ thống.
- Hỗ trợ: 
    - Batch Source: Dữ liệu tĩnh từ kho lưu trữ (S3, MinIO, SQL, Database)
    - Stream Source: Dữ liệu thời gian thực (Kafka, Kinesis)
- Giám sát: Kiểm tra trạng thái kết nối (health check) để đảm bảo nguồn tin cậy.

---

### 3. Module: Phòng thí nghiệm Logic
- Mục tiêu: Nơi các chuyên gia dữ liệu viết công thức biến đổi
- Chức năng chính:
    - Thư viện logic: Lưu trữ và quản lý các đoạn mã xử lý (SQL, Python UDF)
    - Chạy thử (Sandbox): Cho phép thực thi thử nghiệm các đoạn mã trên dữ liệu mẫu để kiểm tra kết quả ngay lập tức trước khi đưa vào sản xuất.
    - Phân loại: Hỗ trợ các kiểu biến đổi từ đơn giản (SQL) đến phức tạp (Python AI logic) và tính toán tổng hợp (Aggregation).

---

### 4. Module: Trình tạo nhóm đặc trưng (Wizard)
Quy trình chuẩn hóa 4 bước để thiết lập một dây chuyền sản xuất đặc trưng tự động:
- Bước 1 - Chọn thực thể: Xác định đối tượng mục tiêu của dữ liệu này là ai/cái gì
- Bước 2 - Nguồn dữ liệu: Chọn kho chứa dữ liệu thô cần xử lý.
- Bước 3 - Logic biến đổi: Áp dụng "công thức" từ thư viện logic vào nguồn dữ liệu.
- Bước 4 - Cấu hình Schema: Hệ thống tự động phân tích dữ liệu đầu ra, liệt kê các đặc trưng (Features) thu được để người dùng xác nhận, đặt tên và mô tả.

---

### 5. Module: Vận hành & Phân phối (Serving)
**5.1. Lập trình đồng bộ (Scheduler)**
- Mục tiêu: Đảm bảo dữ liệu trong kho "nóng" (Online Store) luôn mới nhất
- Chức năng: Thiết lập tần suất chạy tự động (ví dụ: mỗi 15 phút) để cập nhật đặc trưng từ kho lưu trữ vào Redis phục vụ AI

**5.2. Đóng gói Đặc trưng (Feature Views)**
- Mục tiêu: Tạo ra các túi dữ liệu tùy chỉnh cho từng mô hình AI cụ thể.

- Chức năng: Cho phép "nhặt" các đặc trưng lẻ từ nhiều nhóm khác nhau và gom lại thành một tập hợp duy nhất, thiết lập thời gian sống (TTL) cho dữ liệu.

**5.3. Tra cứu trực tuyến (Online Explorer)**
- Mục tiêu: Kiểm tra nhanh giá trị của đặc trưng.

- Chức năng: Nhập ID thực thể để xem ngay lập tức các chỉ số hiện tại đang nằm trong bộ nhớ RAM (Redis).

---

### 6. Module: Giám sát & Điều hành (Monitoring)
**6.1. Bảng điều khiển tổng quan (Dashboard)**
- Theo dõi sức khỏe hệ thống: Số lượng máy chủ đang chạy, tổng số đặc trưng hiện có.

- Biểu đồ hiệu suất: Theo dõi khối lượng dữ liệu được xử lý theo thời gian.

**6.2. Trung tâm quản lý công việc (Job Center)**
- Theo dõi chi tiết từng tiến trình đang chạy ngầm.

- Kiểm soát trạng thái: Đang chạy, Thành công, Thất bại.

- Hỗ trợ xem nhật ký (Logs) để xử lý lỗi khi có sự cố phát sinh.

### 7. Nên dùng Worker-native