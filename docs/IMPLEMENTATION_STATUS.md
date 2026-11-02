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
- Tìm xe theo thời gian + bộ lọc bảo dưỡng theo khoảng thời gian (cần bổ sung thời lượng bảo dưỡng sau khi chốt nghiệp vụ)
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
