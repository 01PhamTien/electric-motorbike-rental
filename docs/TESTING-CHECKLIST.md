# Kế hoạch kiểm thử nghiệm thu - Electric Motorbike Rental

## 1. Phạm vi

Kiểm thử các phân hệ tài khoản, danh mục, đặt thuê, giao nhận, thanh toán/quyết toán, bảo dưỡng, vị trí mô phỏng và báo cáo.

## 2. Chuẩn bị môi trường

- Docker Desktop đang chạy; MySQL container ở trạng thái healthy.
- Backend và frontend đã cài dependencies.
- Đã chạy seed theo hướng dẫn dự án.
- Có tài khoản ADMIN, STAFF tại ít nhất hai điểm thuê khác nhau và CUSTOMER.
- Không chạy seed trên cơ sở dữ liệu đang có dữ liệu thật.

## 3. Ma trận kiểm thử

| ID | Phân hệ | Thao tác | Kết quả mong đợi |
|---|---|---|---|
| AUTH-01 | Tài khoản | Đăng nhập đúng thông tin | Nhận token và vào hệ thống |
| AUTH-02 | Tài khoản | Đăng nhập sai mật khẩu | Bị từ chối, không phát hành token |
| AUTH-03 | Phân quyền | CUSTOMER gọi API quản trị nhân viên | HTTP 403 |
| AUTH-04 | Phân quyền | STAFF truy cập dữ liệu điểm thuê khác | HTTP 403 hoặc không trả dữ liệu ngoài phạm vi |
| BOOK-01 | Đặt thuê | Đặt xe với thời gian trả sau thời gian nhận | Tạo đơn PENDING |
| BOOK-02 | Đặt thuê | Đặt xe có lịch trùng đơn còn hiệu lực | Bị từ chối |
| BOOK-03 | Đặt thuê | Hai yêu cầu đồng thời giữ cùng xe và khoảng thời gian | Tối đa một yêu cầu thành công |
| BOOK-04 | Đặt thuê | CUSTOMER xem đơn của CUSTOMER khác | HTTP 403 hoặc 404 |
| BOOK-05 | Đặt thuê | Hủy đơn không đủ điều kiện | Bị từ chối, trạng thái không đổi |
| HAND-01 | Giao xe | Giao xe khi đơn chưa CONFIRMED | Bị từ chối |
| HAND-02 | Giao xe | Giao xe cho đơn CONFIRMED với chỉ số hợp lệ | Lưu biên bản và chuyển RENTING |
| HAND-03 | Trả xe | Trả xe khi đơn chưa RENTING | Bị từ chối |
| HAND-04 | Trả xe | Ghi số km trả nhỏ hơn số km nhận | Bị từ chối |
| HAND-05 | Trả xe | Gửi lặp yêu cầu giao/trả | Không tạo biên bản trùng hoặc chuyển trạng thái lặp |
| PAY-01 | Thanh toán | Thu tiền thuê trong hạn mức còn phải thu | Ghi giao dịch |
| PAY-02 | Thanh toán | Thu vượt tiền thuê còn phải thu | Bị từ chối |
| PAY-03 | Tiền cọc | Thu vượt tiền cọc cần nhận | Bị từ chối |
| PAY-04 | Tiền cọc | Hoàn cọc khi đơn chưa COMPLETED | Bị từ chối |
| PAY-05 | Tiền cọc | Hoàn vượt tiền cọc còn lại sau khấu trừ | Bị từ chối |
| PAY-06 | Chống lặp | Gửi lại cùng idempotency key và payload | Trả giao dịch cũ, không tạo giao dịch mới |
| PAY-07 | Chống lặp | Dùng lại idempotency key với payload khác | Bị từ chối |
| MAINT-01 | Bảo dưỡng | Tạo phiếu cho xe hợp lệ | Tạo phiếu, xe chuyển MAINTENANCE |
| MAINT-02 | Bảo dưỡng | Tạo phiếu thứ hai khi xe đang bảo dưỡng | Bị từ chối |
| MAINT-03 | Bảo dưỡng | Chuyển SCHEDULED -> IN_PROGRESS -> COMPLETED | Ghi completedAt và khôi phục trạng thái xe |
| MAINT-04 | Bảo dưỡng | Chuyển trạng thái không hợp lệ hoặc sửa phiếu đã kết thúc | Bị từ chối |
| GPS-01 | Vị trí | Lưu tọa độ trong giới hạn | Tạo bản ghi MANUAL_SIMULATION |
| GPS-02 | Vị trí | Lưu vĩ độ ngoài -90..90 hoặc kinh độ ngoài -180..180 | Bị từ chối |
| GPS-03 | Vị trí | Tải lại trang sau khi lưu | Vị trí gần nhất và lịch sử vẫn còn |
| GPS-04 | Vị trí | STAFF cập nhật xe ngoài điểm được giao | HTTP 403 |
| REPORT-01 | Báo cáo | CUSTOMER/STAFF gọi API overview | HTTP 403 |
| REPORT-02 | Báo cáo | ADMIN gọi overview không lọc ngày | Trả tổng quan |
| REPORT-03 | Báo cáo | ADMIN lọc from/to hợp lệ | Dữ liệu đơn và giao dịch tuân theo khoảng ngày |
| REPORT-04 | Báo cáo | from lớn hơn to hoặc ngày không hợp lệ | HTTP 400 |
| REPORT-05 | Báo cáo | Đối soát giao dịch | Tiền thuê, cọc, phụ phí, hoàn tiền khớp payment_transactions |

## 4. Lệnh kiểm tra kỹ thuật

Backend:

```powershell
cd D:\electric-motorbike-rental\backend
npm install
npm run build
```

Frontend:

```powershell
cd D:\electric-motorbike-rental\frontend
npm install
npm run build
```

Kiểm tra container:

```powershell
cd D:\electric-motorbike-rental
docker compose ps
```

## 5. Nguyên tắc nghiệm thu

- Ghi lại kết quả PASS/FAIL, request, response và dữ liệu đối chiếu cho từng ID.
- Dùng dữ liệu thử nghiệm, không dùng dữ liệu khách hàng thật.
- Kiểm tra quyền ở backend; ẩn nút trên frontend không thay thế kiểm tra phân quyền API.
- Không đánh dấu nghiệm thu nghiệp vụ nếu mới chỉ build thành công.
- Chưa kiểm thử tải, bảo mật chuyên sâu, thanh toán trực tuyến hoặc GPS phần cứng trong phạm vi hiện tại.

## 6. Các quy tắc cần chốt trước khi mở rộng

- Công thức phí trả muộn và phí hủy đơn.
- Quy tắc ghi nhận doanh thu kế toán; tiền cọc phải được theo dõi riêng.
- Thời hạn giữ chỗ PENDING và cấu hình vận hành.
- Chính sách lưu trữ ảnh/biên bản và thời hạn lưu dữ liệu.
