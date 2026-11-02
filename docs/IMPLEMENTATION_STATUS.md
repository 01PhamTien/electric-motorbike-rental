# Implementation Status

## Đã dựng
- Monorepo frontend/backend
- MySQL Docker Compose
- Auth đăng ký/đăng nhập JWT
- Phân quyền CUSTOMER/STAFF/ADMIN
- Users / GET users/me
- Stations public list + admin create/update
- Vehicles public list/detail + admin create/update
- Bookings create/my/detail/confirm/cancel
- Transaction + pessimistic lock khi đặt xe
- Snapshot giá + tiền cọc
- Hold expiration check khi xác nhận
- Phạm vi điểm thuê cho STAFF ở xử lý đơn
- Manual simulated vehicle locations + lịch sử
- Swagger
- Frontend login/register/stations/vehicles/my bookings

## Cần hoàn thiện tiếp
- Vehicle model CRUD
- Kiểm tra booking: từ chối xe có phiếu bảo dưỡng SCHEDULED/IN_PROGRESS (đặc tả hiện chỉ có scheduledAt, chưa định nghĩa thời điểm kết thúc nên phiếu mở khóa toàn bộ xe đến khi hoàn tất/hủy)
- API tìm xe còn trống theo thời gian nhận/trả, điểm thuê, dòng xe và khoảng giá; trả về số ngày tính phí và tiền thuê dự kiến
- Frontend tìm xe theo thời gian, điểm thuê, dòng xe, giá và từ khóa; hiển thị giá dự kiến trước khi đặt
- Lịch thuê PENDING còn hạn, CONFIRMED và RENTING được tính là xung đột khi khoảng thời gian giao nhau
- Phiếu bảo dưỡng SCHEDULED/IN_PROGRESS loại xe khỏi kết quả tìm kiếm vì schema hiện chưa có thời điểm kết thúc bảo dưỡng
- Booking expiration scheduler (implemented: checks on startup and every 60 seconds; writes EXPIRED status history)
- Expired PENDING holds no longer block vehicle availability
- Pickup/return records + images
- Charges + payment transactions + idempotency
- Maintenance CRUD + conflict checking
- Deposit deduction/refund
- Late return/cancellation revenue rules sau khi chốt nghiệp vụ
- Reports
- Admin/staff frontend
- Google Maps UI
- Upload ảnh
- Migrations + seed + tests


## Booking lifecycle hardening
- Xác nhận và hủy đơn dùng transaction + khóa bản ghi booking để tránh cập nhật trạng thái đồng thời
- Khi xác nhận đơn PENDING đã quá hạn, chuyển EXPIRED và ghi lịch sử trước khi trả lỗi
- Hủy đơn ghi cancelReason và status history trong cùng transaction
- API GET /bookings/:id/history trả lịch sử theo quyền sở hữu/điểm thuê
- Trang đơn thuê khách hàng hiển thị timeline lịch sử trạng thái


## Handover evidence improvements
- Handover DTO validates battery percentage (0-100), non-negative odometer, condition note and up to 10 image URLs.
- Added `handover_images` entity and relation to handover records.
- Image evidence rows and handover status transition are saved in the same database transaction.
- Handover history endpoint returns image relations.
- Staff handover form accepts image URLs, one per line. This stores references only; direct binary file upload/storage is not implemented yet.
