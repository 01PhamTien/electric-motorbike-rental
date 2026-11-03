# VoltGo — Hình ảnh dòng xe và bản đồ điểm nhận

## 1. Chạy migration sau khi git pull

Backend đã bổ sung **cột `vehicle_models.imageUrl`**, cho phép Admin đổi ảnh cho mỗi **dòng xe** mà không sửa mã nguồn. Migration chỉ thêm cột nullable, không xóa xe, đơn thuê, ảnh hay dữ liệu có sẵn.

Từ `backend/`, dùng cấu hình `.env` SQL Server hiện có:

```powershell
npm run migration:run:mssql
npm run migration:check:mssql
npm run start:dev
```

Không chạy `DB_SYNCHRONIZE=true`. Nếu vẫn đang dùng MySQL, dùng lệnh `npm run migration:run`.

## 2. Tự thay ảnh xe sau này

Vào Admin → **Dòng xe** (`/admin/models`) → **Chỉnh sửa** → **Đường dẫn ảnh**. Ví dụ:

```text
/images/vehicle-models/vinfast-feliz-s.webp
```

Bỏ ảnh tự chọn vào:

```text
frontend/public/images/vehicle-models/vinfast-feliz-s.webp
```

Có thể dùng file PNG/JPG/WEBP hoặc URL **HTTPS**. Có thể đặt tên bất kỳ miễn giống đường dẫn được nhập. Mỗi dòng xe dùng một ảnh; tất cả xe thuộc cùng dòng sẽ tự hiện ảnh đó ở trang chủ và danh sách xe.

Nếu ảnh chưa được tìm thấy, bị lỗi hoặc chưa cấu hình, website vẫn hiện ảnh minh họa xe điện mặc định. Không có ảnh nào bị tải lên SQL Server: database chỉ lưu **đường dẫn**. Khi phân phối thật, chỉ sử dụng ảnh bạn có quyền sử dụng, và ưu tiên ảnh được lưu tại `frontend/public` để giảm phụ thuộc bên ngoài.

## 3. Bản đồ điểm nhận xe

Trang `/stations` nay có bản đồ OpenStreetMap lớn để chọn từng điểm nhận, bản đồ nhỏ ngay trên mỗi card, nút mở chỉ đường Google Maps, địa chỉ và điện thoại.

Dữ liệu lấy từ `stations.latitude` và `stations.longitude` đã có trong database, không cần migration cho bản đồ. Admin sửa tọa độ tại `/admin/stations`. Map cần Internet vì tải từ OpenStreetMap, nhưng không cần API key. Các vị trí seed demo chỉ là **tọa độ tham khảo**, không phải điểm thuê đã được xác minh.

## 4. Khởi động frontend

```powershell
cd D:\electric-motorbike-rental\frontend
npm run dev
```

Lưu ý khi cập nhật code mới, hãy đảm bảo `git pull origin main` và chạy migration SQL Server **trước khi** tải các trang có ảnh để tránh lỗi cột chưa tồn tại.
