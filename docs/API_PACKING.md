# API hành trang cá nhân — Bước 3.3

Mỗi món đồ tạo qua API có `isShared: false`, `assignedToMemberId` lấy từ thành viên `ACTIVE` của **người dùng trong cookie phiên** và `isPacked: false` khi tạo. Migration `20261124000000_personal_packing_categories` thêm bảng `PackingCategory` và cột `PackingItem.categoryId` có thể để trống. Món đã có xuất hiện trong nhóm **Chưa phân loại**.

Không có danh sách chung hoặc quyền xem hộ. OWNER cũng không được xem/sửa/xóa đồ của người đồng hành. Backend bỏ qua trường ownership/sharing trong body và query; GET luôn lọc đủ `tripId`, `assignedToMemberId` của người gọi và `isShared: false`. Các bản ghi cũ shared/unassigned không xuất hiện trong API này. Trip detail và demo preview không nhúng dữ liệu packing.

## Hợp đồng

Mọi endpoint dưới `/api/trips/:tripId/packing` yêu cầu cookie hợp lệ và `tripAccess` ACTIVE.

| Method | Đường dẫn tiếp nối | Body | Kết quả |
| --- | --- | --- | --- |
| GET | `/` | — | 200 `{ items, categories, stats: { total, packed, percentage } }` |
| POST | `/categories` | `{ "name": "Quần áo" }` | 201 `{ category: { id, name } }` |
| POST | `/` | `{ "title": "Áo khoác ấm", "categoryId"?: string \| null }` | 201 món đồ mới |
| PATCH | `/:itemId` | `{ "title"?: string, "categoryId"?: string \| null, "isPacked"?: boolean, "version"?: number }` | 200 món đồ đã cập nhật, version tăng 1 |
| DELETE | `/:itemId` | Không body hoặc `{ "version"?: number }` | 200 món đồ vừa xóa |
| POST | `/templates` | Không body hoặc `{}` | 200 `{ items, categories, stats, addedCount }` |

Món đồ trả về gồm `id`, `title`, `categoryId`, `isPacked`, `version`, `createdAt`, `updatedAt`. `percentage = total ? Math.round(packed * 100 / total) : 0`. Thống kê chỉ tính đồ của người gọi.

Tên món đồ được trim và phải dài 1–160 ký tự. PATCH cần ít nhất một trong ba trường `title`, `categoryId`, `isPacked`. Gửi `categoryId: null` để bỏ phân loại. Bỏ trường `categoryId` trong PATCH để giữ danh mục hiện tại. `version` là số nguyên dương trong miền PostgreSQL Int. API cho phép bỏ version và frontend gửi version của bản đang sửa. Khi version không khớp, API trả 409 kèm `currentVersion`.

Danh mục được lưu theo thành viên của chuyến đi và trả về theo thứ tự tạo, kể cả nhóm rỗng. Tên danh mục dài 1–60 ký tự sau khi chuẩn hóa Unicode NFC và khoảng trắng. Trùng tên trong balo của cùng thành viên trả 409, kể cả khi chỉ khác hoa thường. Món đồ chỉ nhận `categoryId` thuộc balo của chính người gọi trong chuyến hiện tại. ID danh mục ngoài phạm vi hoặc không tồn tại trả 404.

Thiếu phiên trả 401; ngoài chuyến, membership REVOKED, đồ của người khác hoặc đồ shared/unassigned trả 403. ID không tồn tại/đã xóa/thuộc chuyến khác trả 404. Kiểm tra ownership diễn ra trước kiểm tra version để lỗi không tiết lộ chi tiết đồ của người khác. Dữ liệu vào không hợp lệ trả 400. Response có `Cache-Control: no-store`.

DELETE xóa vật lý món đồ. Danh mục vẫn hiển thị khi món cuối cùng trong nhóm bị xóa.

## Gợi ý và tính nhất quán

`packing.templates.ts` khai báo bảy món đúng đặc tả: áo ấm/chống nước, giấy tờ xe và CCCD, găng tay/giày, sạc dự phòng/cáp, thuốc cá nhân, kính và vệ sinh cá nhân. Chỉ so sánh với đồ riêng của người gọi, chuẩn hóa Unicode NFC, khoảng trắng và hoa/thường. Các món hiện có giữ nguyên tên, version, trạng thái và danh mục. Gợi ý mới thuộc **Chưa phân loại**. Nạp lại hoặc nạp đồng thời không tạo trùng gợi ý.

Các lệnh ghi khóa Trip, kiểm tra lại thành viên ACTIVE trong transaction và khóa món đồ khi sửa/xóa. Khóa Trip cũng tuần tự hóa việc nạp template khi schema không có unique title. Chỉ version món đồ thay đổi; không tăng Trip.version vì hành trang cá nhân không thay đổi cấu hình chung. Services tham gia transaction của caller hoặc tự mở transaction. GET dùng snapshot Repeatable Read cho membership, danh sách và thống kê nhất quán.

Mọi thao tác ghi hỗ trợ middleware `Idempotency-Key` hiện có. Header tùy chọn cho API; frontend luôn gửi UUID. Cùng người, key và payload được replay nguyên response thành công; khác payload/người dùng trả 409. Quyền ACTIVE được kiểm tra trước replay. Key phải tuân theo hợp đồng chung ở [API_AUTH.md](API_AUTH.md); ghi dữ liệu và cache commit/rollback cùng transaction.

## Kiểm thử

`npm run test:packing` kiểm tra qua HTTP/PostgreSQL các luồng tạo và phân loại món đồ, quyền riêng tư giữa các thành viên và chuyến đi, tạo trùng đồng thời, gợi ý, idempotency, version và rollback. Fixture kiểm thử được tạo riêng và dọn theo ID.

Chi tiết giao diện và nghiệm thu M2: [FRONTEND_PACKING.md](FRONTEND_PACKING.md).
