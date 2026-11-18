# API hành trang cá nhân — Bước 3.3

Model `PackingItem` hiện có được giữ nguyên, không thêm migration. Mỗi món đồ tạo qua API luôn có `isShared: false`, `assignedToMemberId` lấy từ thành viên `ACTIVE` của **người dùng trong cookie phiên** và `isPacked: false` khi tạo.

Không có danh sách chung hoặc quyền xem hộ. OWNER cũng không được xem/sửa/xóa đồ của người đồng hành. Backend bỏ qua trường ownership/sharing trong body và query; GET luôn lọc đủ `tripId`, `assignedToMemberId` của người gọi và `isShared: false`. Các bản ghi cũ shared/unassigned không xuất hiện trong API này. Trip detail và demo preview không nhúng dữ liệu packing.

## Hợp đồng

Mọi endpoint dưới `/api/trips/:tripId/packing` yêu cầu cookie hợp lệ và `tripAccess` ACTIVE.

| Method | Đường dẫn tiếp nối | Body | Kết quả |
| --- | --- | --- | --- |
| GET | `/` | — | 200 `{ items, stats: { total, packed, percentage } }` |
| POST | `/` | `{ "title": "Áo khoác ấm" }` | 201 món đồ mới |
| PATCH | `/:itemId` | `{ "title"?: string, "isPacked"?: boolean, "version"?: number }` | 200 món đồ đã cập nhật, version tăng 1 |
| DELETE | `/:itemId` | Không body hoặc `{ "version"?: number }` | 200 món đồ vừa xóa |
| POST | `/templates` | Không body hoặc `{}` | 200 `{ items, stats, addedCount }` |

Món đồ trả về chỉ gồm `id`, `title`, `isPacked`, `version`, `createdAt`, `updatedAt`; không trả thông tin thành viên khác. `percentage = total ? Math.round(packed * 100 / total) : 0`. Thống kê chỉ tính đồ của người gọi.

Tên được trim và phải dài 1–160 ký tự. PATCH phải có ít nhất `title` hoặc `isPacked`; trạng thái phải là boolean. `version` là số nguyên dương trong miền PostgreSQL Int. API cho phép bỏ version theo yêu cầu Bước 3.3; frontend luôn gửi version của bản đang sửa để phát hiện thiết bị khác cập nhật. Khi version không khớp, trả 409 kèm `currentVersion`, không ghi dữ liệu hoặc cache.

Thiếu phiên trả 401; ngoài chuyến, membership REVOKED, đồ của người khác hoặc đồ shared/unassigned trả 403. ID không tồn tại/đã xóa/thuộc chuyến khác trả 404. Kiểm tra ownership diễn ra trước kiểm tra version để lỗi không tiết lộ chi tiết đồ của người khác. Dữ liệu vào không hợp lệ trả 400. Response có `Cache-Control: no-store`.

PackingItem không có cột tombstone, vì vậy DELETE xóa vật lý. Đây là hành vi của model hiện có; không thêm soft delete hoặc sửa schema.

## Gợi ý và tính nhất quán

`packing.templates.ts` khai báo bảy món đúng đặc tả: áo ấm/chống nước, giấy tờ xe và CCCD, găng tay/giày, sạc dự phòng/cáp, thuốc cá nhân, kính và vệ sinh cá nhân. Chỉ so sánh với đồ riêng của người gọi, chuẩn hóa Unicode NFC, khoảng trắng và hoa/thường; giữ nguyên tên, version, trạng thái đã xếp và đồ tùy chỉnh có sẵn. Nạp lại hoặc nạp đồng thời không tạo trùng gợi ý.

Các lệnh ghi khóa Trip, kiểm tra lại thành viên ACTIVE trong transaction và khóa món đồ khi sửa/xóa. Khóa Trip cũng tuần tự hóa việc nạp template khi schema không có unique title. Chỉ version món đồ thay đổi; không tăng Trip.version vì hành trang cá nhân không thay đổi cấu hình chung. Services tham gia transaction của caller hoặc tự mở transaction. GET dùng snapshot Repeatable Read cho membership, danh sách và thống kê nhất quán.

Mọi thao tác ghi hỗ trợ middleware `Idempotency-Key` hiện có. Header tùy chọn cho API; frontend luôn gửi UUID. Cùng người, key và payload được replay nguyên response thành công; khác payload/người dùng trả 409. Quyền ACTIVE được kiểm tra trước replay. Key phải tuân theo hợp đồng chung ở [API_AUTH.md](API_AUTH.md); ghi dữ liệu và cache commit/rollback cùng transaction.

## Kiểm thử

`npm run test:packing` chạy 15 kiểm tra trên HTTP/PostgreSQL thật: A tạo ba món, B GET rỗng và PATCH/DELETE cả ba nhận 403, OWNER không có ngoại lệ, không giả ownership qua body/query, loại shared/unassigned, CRUD/thống kê/validation, tất cả endpoint kiểm tra phiên/ACTIVE, foreign ID, template riêng và chống trùng đồng thời, idempotency, version/race, rollback toàn bộ transaction. Fixture kiểm thử được tạo riêng và dọn theo ID.

Chi tiết giao diện và nghiệm thu M2: [FRONTEND_PACKING.md](FRONTEND_PACKING.md).
