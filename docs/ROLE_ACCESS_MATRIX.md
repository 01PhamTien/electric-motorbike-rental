# Ma trận phân quyền giao diện

## Vai trò
- CUSTOMER: khách hàng thuê xe.
- STAFF: nhân viên vận hành tại một điểm thuê được phân công.
- ADMIN: quản trị viên toàn hệ thống.

## Ma trận trang
| Trang | CUSTOMER | STAFF | ADMIN |
|---|---:|---:|---:|
| /vehicles | Có | Có | Có |
| /stations | Có | Có | Có |
| /bookings/my | Có | Không | Không |
| /staff/workspace | Không | Có | Có |
| /staff/payments | Không | Có | Có |
| /maintenance | Không | Có | Có |
| /locations | Không | Có | Có |
| /admin/dashboard | Không | Không | Có |
| /admin/staff | Không | Không | Có |

## Quy tắc
- Frontend chỉ hiển thị menu phù hợp với vai trò hiện tại.
- Các route nghiệp vụ dùng RequireRole; nhập URL trực tiếp không vượt qua được kiểm tra vai trò.
- Vai trò và trạng thái người dùng được tải từ GET /users/me, không tin vào dữ liệu role do trình duyệt tự lưu.
- Backend vẫn là lớp bảo vệ cuối cùng: JWT strategy đọc lại người dùng trong DB, từ chối tài khoản không ACTIVE và lấy role/stationId mới nhất.
- STAFF chỉ được xử lý booking, bảo dưỡng và vị trí xe trong stationId được phân công; backend kiểm tra phạm vi ở service.
- CUSTOMER chỉ xem booking của chính mình; backend kiểm tra quyền sở hữu ở service.
- /vehicles và /stations là trang danh mục công khai để khách có thể tra cứu trước khi đăng nhập. Các thao tác ghi dữ liệu vẫn yêu cầu vai trò ADMIN tại API.
- ADMIN có thể vào khu vực vận hành và quản trị; CUSTOMER không được vào khu vực nội bộ.

## Files
- frontend/src/features/auth/AuthContext.tsx
- frontend/src/features/auth/RequireRole.tsx
- frontend/src/app/App.tsx
- frontend/src/layouts/MainLayout.tsx
