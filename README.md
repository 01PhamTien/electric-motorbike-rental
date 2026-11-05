# VoltGo - Electric Motorbike Rental

Hệ thống quản lý cho thuê xe máy điện, hiện triển khai **SQL Server** làm hệ quản trị cơ sở dữ liệu chính thức.

## Yêu cầu

- Node.js 20+
- SQL Server 2019/2022, Express hoặc Developer
- SQL Server Authentication (tài khoản ứng dụng riêng, không dùng tài khoản `sa` khi vận hành)
- TCP/IP được bật cho SQL Server và firewall cho phép kết nối từ backend

## 1. Chuẩn bị SQL Server

Tạo database rỗng tên `VoltGoDB` (hoặc tên khác trong `.env`). Tạo SQL login riêng cho ứng dụng và cấp quyền cần thiết trên database. Không dùng database đang có dữ liệu nếu chưa kiểm tra schema và backup.

Nếu SQL Server chạy local, kiểm tra port TCP trong SQL Server Configuration Manager. Port mặc định thường là 1433; named instance có thể dùng port động.

## 2. Cấu hình và chạy Backend

```bash
cd backend
cp .env.example .env
```

Sửa các biến `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` theo SQL Server của bạn. Giữ `DB_TYPE=mssql`.

```bash
npm ci
npm run migration:show
npm run migration:run:mssql
npm run migration:check:mssql
npm run seed
npm run start:dev
```

Swagger: http://localhost:3000/api/docs

**Lưu ý dữ liệu:** migration khởi tạo SQL Server yêu cầu database trống. Nếu đang có database VoltGo được tạo từ trước, hãy backup và kiểm tra schema trước khi áp dụng quy trình baseline; không chạy migration khởi tạo lên database hiện hữu. Không bật TypeORM `synchronize` trong môi trường dùng dữ liệu thật.

## 3. Chạy Frontend

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

Frontend: http://localhost:5173

## 4. Kiểm tra

```bash
cd backend
npm run build
npm test
npm run test:mssql
```

Bộ kiểm thử tích hợp SQL Server chỉ chạy trên database kiểm thử riêng có tên kết thúc bằng `_test`. Không trỏ test tích hợp vào database phát triển hoặc production.

## 5. Phạm vi cơ sở dữ liệu

- Runtime và migration CLI sử dụng SQL Server.
- Các migration SQL Server nằm trong `backend/src/database/migrations-mssql`.
- Không sử dụng migration MySQL trong môi trường SQL Server.
- CI chạy build/unit tests và kiểm thử tích hợp SQL Server.
