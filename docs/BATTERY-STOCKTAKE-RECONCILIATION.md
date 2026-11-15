# Kiểm kê kho pin và đối soát chênh lệch

## Quy trình

1. ADMIN/STAFF chọn trạm và tạo đợt kiểm kê. Mỗi trạm chỉ có tối đa một đợt OPEN.
2. Hệ thống chụp snapshot pin tại trạm: serial, trạng thái, xe đang lắp và thời điểm cập nhật pin.
3. Nhân viên đánh dấu từng pin PRESENT hoặc MISSING; pin TRANSFERRING tại thời điểm snapshot được miễn kiểm đếm.
4. Pin có serial nhưng không xuất hiện trong snapshot được ghi nhận thành EXTRA, kèm ghi chú/tình trạng thực tế.
5. Hoàn tất khi mọi dòng snapshot đã được ghi nhận.
6. ADMIN xem chênh lệch và duyệt biên bản. Duyệt không tự động sửa kho hoặc chuyển trạng thái pin.

## API

- `GET /batteries/stocktakes?stationId=`: lịch sử kiểm kê; STAFF bị giới hạn theo trạm.
- `POST /batteries/stocktakes`: tạo snapshot với `stationId`, `note?`.
- `PATCH /batteries/stocktakes/:id/items/:itemId`: ghi nhận `countStatus=PRESENT|MISSING`, `observedStatus?`, `note?`.
- `POST /batteries/stocktakes/:id/extras`: ghi nhận pin thừa bằng `serialNumber`, `observedStatus?`, `note?`.
- `PATCH /batteries/stocktakes/:id/complete`: khóa đợt kiểm kê.
- `PATCH /batteries/stocktakes/:id/approve`: ADMIN duyệt biên bản.

## Trạng thái

- OPEN: đang kiểm đếm, được phép sửa các dòng.
- COMPLETED: đã khóa, chờ ADMIN duyệt.
- APPROVED: ADMIN đã xác nhận biên bản.

## Bảo vệ dữ liệu

- Snapshot lưu trạng thái/xe/serial và `systemUpdatedAt`, không phụ thuộc dữ liệu pin thay đổi về sau.
- Khi đánh dấu MISSING, backend khóa và kiểm tra pin chưa bị chuyển trạm hoặc cập nhật kể từ snapshot. Nếu pin đã thay đổi, thao tác bị từ chối để tránh kết luận thất lạc sai.
- Số lượt reservation còn hiệu lực tại thời điểm snapshot được lưu thành `heldReservationCount`; reservation không được gán nhầm vào một viên pin cụ thể vì mô hình reservation hiện giữ số lượng theo trạm.
- Pin TRANSFERRING được đánh dấu miễn kiểm đếm và tự điền PRESENT, tránh coi pin đang trên đường là thất lạc.
- Unique filtered index bảo đảm mỗi trạm chỉ có một đợt OPEN, kể cả khi có request đồng thời.
- STAFF chỉ thao tác trong trạm được phân công; chỉ ADMIN được duyệt.
- Không có thao tác nào trong luồng này tự động thay đổi stationId/status của pin. Điều chỉnh tồn kho cần quy trình riêng có phê duyệt và audit log.

## SQL Server migration và kiểm thử

Migration `1794960000000-AddBatteryStocktakes` tạo bảng header/items, foreign keys, check constraints, indexes và unique filtered index. Rollback chỉ xóa dữ liệu kiểm kê; không thay đổi bảng pin.

Schema test `backend/test/battery-stocktakes-sqlserver.mssql.ts` chỉ chạy khi `DB_TYPE=mssql` và `DB_DATABASE` kết thúc bằng `_test`. Không chạy migration/test destructive trên VoltGoDB local. Build và SQL Server integration test cần được xác nhận trong môi trường dev/test trước khi merge.
