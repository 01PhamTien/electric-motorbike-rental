# Sổ chi phí vận hành pin và phân tích vòng đời

## Nhóm chi phí
- CHARGING: ghi nhận điện năng (kWh), đơn giá điện và thành tiền tự tính, làm tròn 2 chữ số thập phân.
- MAINTENANCE: tự động phát sinh từ chi phí trên phiếu bảo dưỡng khi phiếu chuyển sang COMPLETED. Không nhập lại bằng API ghi chi phí thủ công.
- REPLACEMENT: chi phí thay thế pin/cell hoặc linh kiện.
- OTHER: các khoản chi vận hành khác.

## API
- `POST /batteries/operating-costs`: ghi khoản CHARGING, REPLACEMENT hoặc OTHER.
- `GET /batteries/operating-costs`: danh sách tối đa 500 khoản, lọc theo stationId, from, to, costType, batteryId.
- `GET /batteries/operating-costs/summary`: tổng chi phí, phân nhóm, top 10 pin theo chi phí và tổng hợp theo tháng.
- `from` và `to` là timestamp ISO UTC; khoảng lọc bao gồm cả hai mốc.
- STAFF luôn bị giới hạn stationId được phân công; ADMIN có thể xem toàn hệ thống hoặc lọc theo trạm.

## Quy tắc ghi sổ
- Sạc điện yêu cầu energyKwh > 0 và unitPrice >= 0; amount được tính bằng kWh × đơn giá và làm tròn 2 chữ số.
- REPLACEMENT/OTHER yêu cầu amount không âm.
- Bản ghi không có API sửa/xóa; cần điều chỉnh bằng quy trình kế toán có audit riêng trong tương lai.
- Chi phí bảo dưỡng được tạo trong cùng transaction hoàn tất phiếu, gắn maintenanceTaskId. SQL Server filtered unique index bảo đảm một phiếu chỉ sinh tối đa một khoản.
- Lịch sử chi phí gắn pin và snapshot stationId tại thời điểm phát sinh.

## Giao diện
Trang Kho pin & đổi pin nhanh có dashboard chi phí, lọc ngày/loại/pin, form ghi nhận, bảng sổ chi phí, tổng hợp tháng, top pin có chi phí cao và xuất CSV theo kết quả lọc (tối đa 500 bản ghi API).

## SQL Server
Migration `1795132800000-AddBatteryOperatingCosts` tạo bảng, foreign keys, check constraints và indexes. Schema test `backend/test/battery-operating-costs-sqlserver.mssql.ts` từ chối chạy nếu `DB_TYPE` không phải mssql hoặc `DB_DATABASE` không kết thúc bằng `_test`. Không chạy migration destructive trên VoltGoDB local.
