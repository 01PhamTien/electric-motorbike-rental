# Vòng đời sạc và sức khỏe pin

## Quy tắc trạng thái

| Trạng thái hiện tại | Thao tác | Trạng thái tiếp theo | Quy tắc |
|---|---|---|---|
| INSTALLED | Đổi pin trực tiếp hoặc xác nhận lượt giữ pin | CHARGING | Pin được tháo khỏi xe và mở phiên sạc trong cùng transaction |
| CHARGING | Xác nhận sạc hoàn tất | FULL | Phải có phiên sạc đang mở; đóng phiên, cập nhật `lastChargedAt` và tăng `cycleCount` đúng một lần |
| FULL | Chuyển bảo dưỡng | MAINTENANCE | Pin phải ở kho trạm, không gắn trên xe |
| CHARGING | Dừng sạc để bảo dưỡng | MAINTENANCE | Đóng phiên sạc đang mở; không tăng `cycleCount` |
| MAINTENANCE | Hoàn tất bảo dưỡng | FULL | Không thay đổi `cycleCount` hoặc `lastChargedAt` |
| FULL hoặc MAINTENANCE | Ngừng sử dụng | RETIRED | Pin phải không gắn trên xe |
| RETIRED | Mọi thao tác vòng đời | RETIRED | Trạng thái kết thúc; không được lắp, sạc hoặc cập nhật sức khỏe |

Không cho phép chuyển trạng thái trực tiếp từ INSTALLED. Việc tháo pin khỏi xe phải đi qua nghiệp vụ đổi pin để bảo đảm đồng bộ xe, pin, lịch sử đổi và phiên sạc.

## Phiên sạc

Migration SQL Server `1794873600000-AddBatteryChargeSessions` tạo bảng `battery_charge_sessions`. Mỗi bản ghi lưu pin, trạm, người bắt đầu, người hoàn tất, thời điểm bắt đầu/kết thúc và ghi chú.

Khi triển khai migration, pin đã ở trạng thái CHARGING được backfill một phiên sạc đang mở. Thời điểm bắt đầu lấy từ `updatedAt` hoặc `createdAt` hiện có; ghi chú đánh dấu đây là dữ liệu lịch sử được bổ sung khi nâng cấp, không khẳng định người bắt đầu phiên sạc ban đầu.

Đổi pin trực tiếp và xác nhận đổi theo reservation đều mở phiên sạc trong cùng transaction với cập nhật pin và lịch sử đổi. Chỉ thao tác hoàn tất sạc mới tăng `cycleCount`; dừng sạc để bảo dưỡng không tăng chu kỳ. Khóa bi quan trên bản ghi pin và unique filtered index `UX_battery_charge_sessions_active` ngăn mở đồng thời nhiều phiên sạc cho cùng một pin.

## Theo dõi sức khỏe

Nhân viên hoặc quản trị viên có thể cập nhật `healthPercent` trong khoảng 1–100 cho pin đang thuộc kho trạm và chưa ngừng sử dụng. Không cho phép cập nhật khi pin đang lắp trên xe hoặc đã RETIRED. Hệ thống lưu audit event cho thao tác cập nhật.

Số phần trăm sức khỏe là dữ liệu kiểm tra do nhân viên ghi nhận. Hệ thống không tự suy diễn tình trạng pin chỉ từ `cycleCount` và không tự động ngừng sử dụng pin.

## API

- `PATCH /batteries/:id/complete-charging` — hoàn tất phiên sạc, nhận ghi chú tùy chọn.
- `PATCH /batteries/:id/status` — chuyển trạng thái theo ma trận cho phép.
- `PATCH /batteries/:id/health` — cập nhật sức khỏe pin và ghi chú.
- `GET /batteries/charging/history?page=1&limit=20&stationId=&batteryId=&from=&to=` — truy vấn lịch sử sạc có phân trang và lọc.

Nhân viên chỉ xem và thao tác dữ liệu thuộc trạm được phân công. Quản trị viên có thể truy vấn nhiều trạm hoặc giới hạn theo một trạm.

## Bảo toàn dữ liệu

Migration chỉ tạo bảng lịch sử, index, ràng buộc và backfill các phiên sạc còn thiếu cho pin đang CHARGING. Không cập nhật lại trạng thái, sức khỏe, chu kỳ hoặc thời điểm sạc của các bản ghi pin hiện hữu. Migration có `down` để gỡ bảng lịch sử khi cần rollback; thao tác rollback sẽ xóa dữ liệu phiên sạc được lưu trong bảng này.
