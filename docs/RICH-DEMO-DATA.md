# Bộ dữ liệu demo mở rộng cho VoltGo (SQL Server Express)

Lệnh này chỉ dùng cho **demo/đồ án trên máy cá nhân**, không dùng cho dữ liệu kinh doanh thật.

## Quy mô bổ sung

- 8 trạm giả lập tại những khu vực phổ biến của Đà Nẵng (tọa độ tham khảo, không xác nhận địa chỉ điểm kinh doanh thực)
- 12 mẫu xe điện (thông số và giá thuê chỉ nhằm minh họa, không phải bảng giá chính thức của hãng)
- 120 xe có mã `VG-DEMO-001` đến `VG-DEMO-120`, biển số giả `DEMO-43-...`
- 48 khách hàng và 16 nhân viên *hư cấu*, không dùng email/số điện thoại thực
- 240 đơn thuê giả lập (120 hoàn thành trong quá khứ và 120 lịch tương lai), có trạng thái đa dạng
- 240 biên bản giao/trả xe, 360 dòng giao dịch thuê/cọc/hoàn cọc, 120 vị trí GPS giả lập, 40 bản ghi bảo dưỡng và lịch sử trạng thái

Không tạo giao dịch ngân hàng thật, không tích hợp thiết bị GPS thật, không xác thực địa chỉ trạm.

## Cách chạy trên Windows

Trước tiên hãy bảo đảm các migration của VoltGo đã được chạy và `backend/.env` trỏ đến SQL Server Express local:
`NODE_ENV=development`, `DB_TYPE=mssql`, `DB_HOST=127.0.0.1`, `DB_PORT=14333`,
`DB_DATABASE=VoltGoDB`, `DB_SYNCHRONIZE=false`.

Mở PowerShell:

```powershell
cd D:\electric-motorbike-rental
git pull origin main
cd backend
npm ci
npm run migration:check:mssql
$env:DEMO_SEED_CONFIRM = 'I_UNDERSTAND_THIS_IS_FAKE_DATA'
npm run seed:rich-demo
Remove-Item Env:\DEMO_SEED_CONFIRM
```

Sau đó làm mới trình duyệt. Có thể tạo tài khoản quản trị local ban đầu nếu chưa có bằng `npm run seed` (chỉ local).

## An toàn và chạy lại

- **Không xóa / reset dữ liệu cũ.** Các bản ghi demo mới được thêm vào bằng khóa nhận dạng ổn định.
- Có thể chạy lại, lệnh sẽ kiểm tra và bỏ qua các bản ghi demo đã có.
- Bị chặn nếu `NODE_ENV=production`, database không phải `VoltGoDB` / `*_test`, hoặc thiếu `DEMO_SEED_CONFIRM`.
- Để phân biệt dữ liệu mẫu, tài khoản đều có domain `@demo.voltgo.invalid`, xe mang mã `VG-DEMO`, thanh toán ghi rõ `[DEMO]`.
- Không chia sẻ hoặc sử dụng bộ mật khẩu demo này trên Internet.

## Tài khoản mẫu

Mật khẩu demo của 48 khách và 16 nhân viên hư cấu: `VoltGoDemo@2026`.

Ví dụ email: `customer001@demo.voltgo.invalid`, `station-staff01@demo.voltgo.invalid`.
Các tài khoản này chỉ tồn tại trong SQL Server local đã chạy seed. Bạn có thể đăng nhập thử để kiểm tra vai trò, trạm và đơn thuê.

**Lưu ý:** Mật khẩu demo là mật khẩu dùng chung dễ biết, không được dùng trên website public. Không chạy bộ dữ liệu này ở production.

## Kiểm tra dữ liệu qua SSMS

```sql
USE VoltGoDB;
SELECT COUNT(*) AS Trams FROM stations;
SELECT COUNT(*) AS MauXe FROM vehicle_models;
SELECT COUNT(*) AS Xe FROM vehicles;
SELECT status, COUNT(*) AS SoLuong FROM bookings GROUP BY status;
SELECT purpose, COUNT(*) AS SoLuong FROM payment_transactions GROUP BY purpose;
SELECT COUNT(*) AS BaoDuong FROM maintenance_records;
```

Do lệnh chỉ thêm dữ liệu và giữ bản ghi có sẵn, kết quả thực tế có thể nhiều hơn số lượng được seed.
