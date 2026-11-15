# Theo dõi sức khỏe và bảo dưỡng pin

## Sức khỏe pin

- Dashboard tổng hợp theo trạm hoặc toàn hệ thống.
- Mức đánh giá được cấu hình qua biến môi trường:
  - `BATTERY_HEALTH_WARNING_PERCENT` (mặc định 80)
  - `BATTERY_HEALTH_CRITICAL_PERCENT` (mặc định 65)
  - `BATTERY_CYCLE_WARNING` (mặc định 500)
- CRITICAL khi sức khỏe thấp hơn/ngang ngưỡng nghiêm trọng; WATCH khi sức khỏe thấp hơn/ngang ngưỡng cảnh báo hoặc chu kỳ sạc chạm ngưỡng; RETIRED được phân loại riêng.
- Khi nhân viên ghi nhận đánh giá, hệ thống cập nhật healthPercent hiện tại và thêm một bản ghi lịch sử bất biến, kèm cycleCount, thời điểm và người ghi nhận.
- Không tự động đổi trạng thái pin sang MAINTENANCE/RETIRED do ngưỡng sức khỏe.

## Phiếu bảo dưỡng

Trạng thái: OPEN -> IN_PROGRESS -> COMPLETED hoặc CANCELLED.

Mỗi phiếu lưu pin/trạm, loại công việc, mức ưu tiên, hạn xử lý, mô tả, kết quả, chi phí, người tạo/người hoàn tất và thời gian tương ứng. Chỉ phiếu IN_PROGRESS mới được hoàn tất; kết quả là bắt buộc và chi phí không âm.

## API

- `GET /batteries/health/summary?stationId=`: số liệu và phân loại sức khỏe; STAFF bị giới hạn trạm.
- `GET /batteries/:id/health-history`: lịch sử 100 lần đánh giá gần nhất.
- `POST /batteries/:id/health-checks`: ghi `healthPercent` và `note?`.
- `GET /batteries/maintenance?stationId=`: danh sách phiếu.
- `POST /batteries/maintenance`: tạo phiếu với `batteryId`, `taskType`, `priority?`, `dueAt?`, `description`.
- `PATCH /batteries/maintenance/:id/start`: bắt đầu.
- `PATCH /batteries/maintenance/:id/complete`: hoàn tất với `result` và `cost?`.
- `PATCH /batteries/maintenance/:id/cancel`: hủy phiếu chưa hoàn tất.

## An toàn dữ liệu

- STAFF chỉ thao tác pin/phiếu thuộc trạm được phân công; ADMIN xem toàn hệ thống hoặc lọc theo trạm.
- Ghi nhận sức khỏe khóa dòng pin trong transaction.
- Cập nhật phiếu khóa phiếu và pin, từ chối nếu pin đã chuyển trạm kể từ khi tạo phiếu.
- Phiếu không thể tạo cho pin RETIRED hoặc TRANSFERRING.
- Lịch sử chỉ chọn các trường ID/tên người ghi nhận, không trả password hash hoặc thông tin xác thực.
- Các thao tác được ghi audit log.

## SQL Server

Migration `1795046400000-AddBatteryHealthMaintenance` tạo bảng lịch sử sức khỏe và phiếu bảo dưỡng, foreign keys, check constraints và indexes. Schema test `backend/test/battery-health-maintenance-sqlserver.mssql.ts` chỉ chạy khi `DB_TYPE=mssql` và `DB_DATABASE` kết thúc bằng `_test`. Không chạy migration destructive trên VoltGoDB local.
