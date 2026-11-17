# VoltGo — Hệ thống quản lý cho thuê xe máy điện

VoltGo là đồ án xây dựng nền tảng cho thuê xe máy điện với ba vai trò **Khách hàng (Customer)**, **Nhân viên (Staff)** và **Quản trị viên (Admin)**. Dự án dùng **React + TypeScript + Vite** ở frontend, **NestJS + TypeORM** ở backend và **Microsoft SQL Server** làm cơ sở dữ liệu.

> **Trạng thái:** Dự án có thể chạy và trình diễn các quy trình nghiệp vụ với dữ liệu demo. CI kiểm tra build/typecheck và tích hợp SQL Server trên môi trường kiểm thử; không đồng nghĩa đã xác nhận toàn bộ quy trình bằng giao dịch ngân hàng thực tế.

## Chức năng chính

| Vai trò | Chức năng |
| --- | --- |
| Khách hàng | Đăng ký/đăng nhập, tìm trạm và xe, xem chi tiết xe, đặt/hủy đơn, theo dõi lịch sử thuê, giữ lượt đổi pin, đánh giá xe, xem giao dịch |
| Nhân viên | Xử lý đơn thuê, bàn giao/nhận trả xe, quản lý lịch làm việc, xử lý yêu cầu đổi pin và sự cố, ghi nhận phụ phí/khấu trừ/hoàn cọc |
| Quản trị viên | Quản lý trạm, xe, dòng xe, tài khoản, nhân viên, voucher, bảo dưỡng, vận hành, chi phí và báo cáo |

Các chức năng thanh toán gồm ghi nhận tiền thuê, tiền cọc, phụ phí và hoàn cọc. Tích hợp **SePay** có môi trường Sandbox và Production được cấu hình riêng. **Hoàn cọc hiện là thao tác ghi nhận sau khi nhân viên đã chi trả thực tế, không tự động chuyển khoản ngân hàng.**

## Yêu cầu môi trường

- Node.js **20+**, npm.
- Microsoft SQL Server **2019/2022** (Express/Developer đều phù hợp để demo).
- Bật TCP/IP cho SQL Server; dùng SQL Server Authentication với tài khoản ứng dụng riêng.
- Git, PowerShell (Windows); SSMS để kiểm tra dữ liệu.
- **Cloudflare Tunnel / cloudflared** chỉ cần nếu muốn nhận callback HTTPS từ SePay hoặc truy cập backend qua Internet.

## 1. Tải mã nguồn

```powershell
git clone https://github.com/01PhamTien/electric-motorbike-rental.git
cd electric-motorbike-rental
```

Nếu đã tải trước đó:

```powershell
git checkout main
git pull origin main
```

## 2. Cấu hình và chạy backend

Trong PowerShell:

```powershell
cd backend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm ci
```

Nếu đã có `backend/.env` đang hoạt động, **không ghi đè**. Chỉnh các giá trị tương ứng trong `backend/.env`:

```dotenv
PORT=3000
FRONTEND_URL=http://localhost:5173
DB_TYPE=mssql
DB_HOST=127.0.0.1
DB_PORT=1433
DB_USERNAME=voltgo_app
DB_PASSWORD=your-local-password
DB_DATABASE=VoltGoDB
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
```

`DB_PORT` phải đúng với cổng TCP SQL Server trên máy; một số bản cài đặt sử dụng cổng khác 1433. Không commit file `.env` hoặc mật khẩu lên GitHub.

**Đối với database mới, hoàn toàn trống**, sau khi cấu hình kết nối:

```powershell
npm run migration:show
npm run migration:run:mssql
npm run migration:check:mssql
npm run seed
npm run start:dev
```

**Đối với database đã có dữ liệu:** sao lưu và kiểm tra lịch sử migration trước. **Không chạy migration khởi tạo hoặc seed lại một cách tùy tiện.** Nếu database cũ chưa có lịch sử migration, xem [hướng dẫn migration](docs/DATABASE-MIGRATIONS.md) và issue #64; công cụ baseline hiện không tự động sửa database cũ.

Để khởi động backend những lần sau:

```powershell
cd backend
npm run start:dev
```

API mặc định: `http://localhost:3000/api`; Swagger: `http://localhost:3000/api/docs` (khi được bật).

## 3. Cấu hình và chạy frontend

Mở **cửa sổ PowerShell khác** tại thư mục gốc dự án:

```powershell
cd frontend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm ci
npm run dev
```

Nếu đã có `frontend/.env`, không cần tạo lại. Nội dung cho demo local:

```dotenv
VITE_API_URL=http://localhost:3000/api
```

Mở **http://localhost:5173** để sử dụng website.

## 4. Cloudflare Tunnel — HTTPS cho backend và SePay

Cloudflare Tunnel giúp công khai backend đang chạy tại `http://localhost:3000` qua một địa chỉ HTTPS tạm thời, phù hợp khi thử **SePay IPN**. Không cần Tunnel nếu chỉ demo website và API trên cùng máy.

### Khởi chạy

1. Cài `cloudflared` từ [hướng dẫn chính thức của Cloudflare](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).
2. Đảm bảo backend đã chạy ở cổng 3000.
3. Mở cửa sổ PowerShell **thứ ba** và chạy:

```powershell
cloudflared tunnel --url http://localhost:3000
```

4. Trong log của `cloudflared`, tìm **địa chỉ HTTPS dạng `https://...trycloudflare.com`**. Đó mới là URL công khai để sử dụng.

**Ví dụ log kết nối thành công đã ghi nhận trong quá trình phát triển:**

```text
2026-11-16T21:42:43Z INF Registered tunnel connection connIndex=0 connection=aaf844d4-788a-48c3-847b-a308d1f6b943 event=0 ip=2606:4700:a0::10 location=hkg09 protocol=quic
```

Log này cho biết `cloudflared` đã đăng ký một kết nối tới Cloudflare qua **QUIC** (điểm kết nối `hkg09`). **Đây không phải URL của Tunnel, không phải mã truy cập, và không chứng minh SePay đã gửi callback thành công.** URL `trycloudflare.com` thường được in ở dòng log khác. Tunnel tạm thời có thể đổi URL mỗi lần chạy; giữ cửa sổ `cloudflared` mở trong lúc demo.

### Kết nối SePay Sandbox với Tunnel

Trong `backend/.env`:

```dotenv
SEPAY_ENV=sandbox
SEPAY_PUBLIC_URL=https://your-current-tunnel.trycloudflare.com
SEPAY_MERCHANT_ID_SANDBOX=
SEPAY_SECRET_KEY_SANDBOX=
SEPAY_IPN_SECRET_SANDBOX=
```

Thay `SEPAY_PUBLIC_URL` bằng URL HTTPS thực tế của Tunnel, **không thêm `/api` vào cuối**. Điền khóa Sandbox lấy từ tài khoản SePay của bạn, không đưa khóa vào Git hoặc ảnh chụp màn hình.

Trong phần cấu hình IPN của SePay, đặt endpoint:

```text
https://your-current-tunnel.trycloudflare.com/api/payments/sepay/ipn
```

Dùng phương thức xác thực `SECRET_KEY` với cùng secret đã cấu hình trong backend. Khởi động lại backend sau khi đổi `.env`. Kiểm tra HTTPS công khai và luồng IPN thực tế trước khi khẳng định thanh toán hoạt động. **Không dùng thông tin Production để demo Sandbox.**

Tài liệu chi tiết: [SePay Sandbox](docs/SEPAY-SANDBOX.md) · [SePay Production](docs/SEPAY-PRODUCTION.md).

## 5. Quy trình demo gợi ý

1. **Customer:** đăng nhập → xem trạm/xe → chọn xe → đặt xe → xem đơn và tiền cọc.
2. **Staff:** xem đơn → xác nhận → bàn giao xe → nhận trả xe.
3. **Staff:** ghi nhận phụ phí hoặc khấu trừ nếu có → vào trang thanh toán của đơn → ghi nhận hoàn cọc sau khi đã chi trả.
4. **Customer/Staff:** trình diễn giữ pin, đổi pin tại trạm.
5. **Admin:** xem quản lý xe, trạm, lịch nhân viên, bảo dưỡng, chi phí và báo cáo.

**Lưu ý:** Dữ liệu tiếng Việt từng lưu bằng `varchar` có thể đã biến ký tự thành `?`. Các migration `NVARCHAR` mới ngăn phát sinh lỗi tương tự nhưng không tự phục hồi dữ liệu đã mất; cần đối chiếu seed hoặc bản sao lưu trước khi sửa.

## 6. Kiểm thử

```powershell
cd backend
npm run build
npm test
```

Chỉ chạy `npm run test:mssql` trên **database kiểm thử riêng có tên kết thúc bằng `_test`** và được cấu hình đúng; không chạy trên `VoltGoDB` có dữ liệu demo hoặc dữ liệu thật.

Frontend:

```powershell
cd frontend
npm run build
```

GitHub Actions chạy build/typecheck và bộ kiểm thử SQL Server trên môi trường CI. Kết quả CI không thay thế việc kiểm tra trực tiếp database và giao diện trên máy triển khai.

## 7. Tài liệu kỹ thuật

- [Hướng dẫn SQL Server trên Windows](docs/SQLSERVER-EXPRESS-WINDOWS.md)
- [Migration và database hiện hữu](docs/DATABASE-MIGRATIONS.md)
- [Dữ liệu demo](docs/RICH-DEMO-DATA.md)
- [SePay Sandbox](docs/SEPAY-SANDBOX.md)
- [SePay Production](docs/SEPAY-PRODUCTION.md)
- [Checklist kiểm thử đặt xe](docs/booking-regression-checklist.md)

## Lưu ý bảo mật

Không đưa mật khẩu SQL Server, JWT secret, SePay merchant secret/IPN secret hoặc file `.env` lên repository. Cloudflare Quick Tunnel phù hợp thử nghiệm ngắn hạn, **không phải phương án triển khai Production lâu dài**. Nếu công khai backend qua Internet, cần cấu hình xác thực, giới hạn truy cập, kiểm tra IPN và giám sát phù hợp.
