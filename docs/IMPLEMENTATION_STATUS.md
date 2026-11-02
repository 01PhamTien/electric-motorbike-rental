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
- Tìm xe theo thời gian + kiểm tra maintenance
- Booking expiration scheduler
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
