# Sửa bản đồ trắng và lỗi ERR_CONNECTION_REFUSED (2026-11-03)

Khi trình duyệt từ chối kết nối đến `tile.openstreetmap.org`, các ô bản đồ cũ hiển thị biểu tượng ảnh bị hỏng. Đây là lỗi truy cập nguồn bản đồ qua mạng, **không phải lỗi tọa độ trạm hay SQL Server**.

Trang `/stations` đã chuyển sang **OpenFreeMap vector maps** (`https://tiles.openfreemap.org/styles/liberty`) sử dụng MapLibre GL JS; không còn tải ảnh từ `tile.openstreetmap.org`. Bản đồ thu nhỏ chỉ khởi tạo khi nằm trong vùng đang xem để giảm tài nguyên trình duyệt.

Nếu trình duyệt cũng chặn mạng tới OpenFreeMap, giao diện sẽ **không hiển thị ô ảnh hỏng**. Thay vào đó, người dùng thấy tên trạm, tọa độ và nút **Mở trên Google Maps**. Không có dịch vụ trực tuyến nào đảm bảo hoạt động khi máy tính không có Internet hoặc firewall chặn mọi nguồn bản đồ.

### Cách cập nhật trên Windows

```powershell
cd D:\electric-motorbike-rental
git switch main
git pull origin main
cd frontend
npm ci
npm run dev
```

Nếu backend vẫn đang chạy thì không cần thay đổi. **Không cần migration hoặc seed.**

Nếu bản đồ dự phòng xuất hiện, thử mở `https://tiles.openfreemap.org/styles/liberty` trên chính trình duyệt đó để kiểm tra đường truyền. Ngoài ra có thể nhấn nút Google Maps trên trạm để xem đường đi. Nếu Google Maps cũng bị chặn, kiểm tra proxy/firewall/DNS hoặc kết nối Internet.

Nguồn bản đồ: OpenFreeMap (https://openfreemap.org/) trên dữ liệu OpenStreetMap. Các trạm seed demo có tọa độ minh họa, cần xác minh địa chỉ trước khi phục vụ khách thật.

---

# Cập nhật: Admin tải ảnh trực tiếp và bản đồ không dùng iframe

## Admin chọn và thay ảnh xe

Sau khi cập nhật code mới, vào **Trung tâm quản trị → Dòng xe** (\`/admin/models\`), nhấn **Chỉnh sửa** và chọn ảnh trực tiếp từ máy qua ô **Tải ảnh từ máy**. Hỗ trợ JPEG/PNG/WEBP tối đa **5 MB**. Ảnh có xem trước, nhấn **Lưu dòng xe** là tải lên backend và đổi ảnh cho tất cả xe cùng mẫu. Cũng có thể chọn ảnh ngay khi tạo dòng xe mới.

- API \`POST /api/vehicle-models/:id/image\` là **ADMIN only**, nhận \`multipart/form-data\` với trường \`image\`.
- File được lưu tại \`backend/uploads/vehicle-models/\` khi khởi chạy backend trong thư mục \`backend/\`. Có thể cấu hình thư mục qua \`VOLTGO_UPLOAD_DIR\` (đường dẫn tuyệt đối được khuyến nghị).
- SQL Server chỉ lưu \`/api/vehicle-models/images/<random-uuid>.<ext>\`; ảnh được cung cấp qua backend, không cần chép vào frontend.
- **Cần sao lưu cả thư mục \`uploads\` lẫn SQL Server**. Git bỏ qua thư mục uploads và \`git pull\` không đồng bộ ảnh lên máy khác.
- Không dùng ảnh có bản quyền khi chưa được phép. Môi trường production nên dùng object storage/CDN và kiểm soát tài nguyên riêng.
- Các URL ảnh cũ và ảnh lưu trong \`frontend/public/images/vehicle-models/\` vẫn được hỗ trợ.

## Sửa lỗi OpenStreetMap từ chối kết nối

Lỗi \`www.openstreetmap.org đã từ chối kết nối\` là do OpenStreetMap chặn hiển thị toàn bộ website bên trong iframe ở một số trình duyệt/cấu hình.

VoltGo nay không nhúng \`www.openstreetmap.org\` bằng iframe nữa. Thay vào đó, frontend tải **raster tiles** qua \`https://tile.openstreetmap.org\` và vẽ bản đồ/ghim trạm ngay trong React. Bản đồ lớn có kéo, phóng to/thu nhỏ, trở về vị trí trạm. Các card trạm có ảnh bản đồ nhỏ.

Cần kết nối Internet để tải tile. Nếu mạng, extension hoặc firewall chặn \`tile.openstreetmap.org\`, hãy kiểm tra truy cập miền đó; với môi trường khai thác thương mại cần tile provider phù hợp và tuân thủ OpenStreetMap Tile Usage Policy. Không cần API key trong bản demo local.

## Cập nhật

\`\`\`powershell
cd D:\electric-motorbike-rental
git switch main
git pull origin main
cd backend
npm run migration:check:mssql
npm run start:dev
\`\`\`

Mở một PowerShell khác: \`cd D:\electric-motorbike-rental\frontend; npm run dev\`.

**Không cần migration mới cho thay đổi này**: cột \`imageUrl\` đã được thêm ở PR trước. Nếu bạn chưa từng chạy migration cột ảnh, trước hết chạy \`npm run migration:run:mssql\`.

---

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
