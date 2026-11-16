# Điều chuyển pin độc lập giữa các trạm

## Vòng đời phiếu

| Trạng thái | Ý nghĩa | Tác động đến pin |
|---|---|---|
| PENDING | Đã lập phiếu, chờ trạm nguồn bàn giao | Pin chuyển sang TRANSFERRING và không còn được tính là pin FULL khả dụng |
| IN_TRANSIT | Trạm nguồn đã bàn giao | Pin tiếp tục ở trạng thái TRANSFERRING, stationId vẫn là trạm nguồn cho đến khi xác nhận nhận |
| COMPLETED | Trạm đích đã nhận đủ danh sách pin | stationId đổi sang trạm đích, trạng thái trở về FULL |
| CANCELLED | Hủy trước bàn giao | Pin trở lại FULL tại trạm nguồn |

## API

- `GET /batteries/transfers`: lịch sử phiếu; STAFF chỉ thấy phiếu có trạm nguồn hoặc trạm đích là trạm được phân công.
- `POST /batteries/transfers`: tạo phiếu với `sourceStationId`, `destinationStationId`, `batteryIds[]`, `note?`.
- `PATCH /batteries/transfers/:id/dispatch`: xác nhận bàn giao tại trạm nguồn.
- `PATCH /batteries/transfers/:id/receive`: xác nhận tiếp nhận tại trạm đích.
- `PATCH /batteries/transfers/:id/cancel`: hủy phiếu PENDING tại trạm nguồn.

## Quy tắc an toàn

- Chỉ pin FULL, không gắn xe và thuộc trạm nguồn mới được chọn.
- Không thể điều chuyển nếu lượng pin FULL còn lại sau khi trừ reservation đang hiệu lực thấp hơn số pin yêu cầu.
- Tạo phiếu khóa các hàng pin theo thứ tự ID và chuyển trạng thái sang TRANSFERRING trong cùng transaction.
- Các nghiệp vụ lắp/đổi pin chỉ chấp nhận FULL nên không thể lấy pin đang điều chuyển.
- Chỉ được hủy trước bàn giao; phiếu IN_TRANSIT phải được tiếp nhận, không có thao tác hủy tùy tiện.
- STAFF chỉ tạo/bàn giao tại trạm nguồn được phân công và chỉ tiếp nhận tại trạm đích được phân công. ADMIN có thể thao tác toàn hệ thống.

## SQL Server migration

Migration `1794873600000-AddBatteryTransfers` tạo hai bảng phiếu và chi tiết, các khóa ngoại/index cần thiết, đồng thời mở rộng CHECK constraint trạng thái pin để nhận `TRANSFERRING`. Không cập nhật các bản ghi pin hiện hữu.

Rollback bị chặn nếu còn pin ở trạng thái TRANSFERRING. Hãy hoàn tất hoặc hủy các phiếu đang mở trước khi rollback. Chỉ chạy migration trên database test/dev đã backup theo quy trình dự án; không chạy destructive test trên VoltGoDB local.

## Kiểm thử cần thực hiện

- Tạo phiếu nhiều pin; xác nhận tồn kho FULL giảm ngay khi tạo.
- Không thể lắp/đổi pin đang TRANSFERRING.
- Không thể tạo phiếu nếu pin đang được giữ trước khiến tồn kho khả dụng không đủ.
- Bàn giao và tiếp nhận làm chuyển stationId đúng một lần.
- Hủy PENDING hoàn pin về FULL; không hủy IN_TRANSIT.
- STAFF không thể tạo, bàn giao hoặc tiếp nhận ngoài phạm vi trạm.
- Hai yêu cầu đồng thời cùng chọn một pin: chỉ một giao dịch thành công.
