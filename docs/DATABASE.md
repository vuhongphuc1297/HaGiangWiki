# HaGiangWiki — Cơ sở dữ liệu

Backend dùng PostgreSQL và Prisma CLI/Client **6.19.3**, giữ đúng cấu hình `datasource.url = env("DATABASE_URL")`, generator `prisma-client-js` và `package.json#prisma.seed` theo yêu cầu. [Prisma 7 thay đổi cách cấu hình datasource, driver adapter và seed](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7), vì vậy không nâng major một gói riêng lẻ.

## Chuẩn bị

1. Cài và khởi động PostgreSQL. Môi trường đã nghiệm thu dùng PostgreSQL 18.
2. Sao chép `backend/.env.example` thành `backend/.env` khi lấy dự án trên máy mới.
3. Cấu hình kết nối:

```dotenv
PORT=5000
CLIENT_URL=http://localhost:5173
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hagiangwiki?schema=public"
```

`DATABASE_URL` là bắt buộc và được Zod validate dạng URL. Nếu đổi mật khẩu, URL-encode các ký tự đặc biệt. `.env` được Git bỏ qua; chỉ `.env.example` được lưu cùng mã nguồn.

Nếu database chưa tồn tại, tạo bằng pgAdmin hoặc `psql` sau khi kết nối vào database `postgres`:

```sql
CREATE DATABASE hagiangwiki;
```

Tài khoản chạy `migrate dev` cần quyền tạo shadow database, hoặc cấu hình shadow database riêng theo tài liệu Prisma. Các lệnh dưới đây thao tác đúng database trong `backend/.env`; không dùng migration reset để xử lý database có dữ liệu cần giữ.

## Migration, seed và Studio

Từ thư mục gốc:

```sh
npm run install:all
npm run db:migrate --workspace backend
npm run db:seed --workspace backend
npm run db:verify --workspace backend
npm run db:studio --workspace backend
```

Studio dùng cổng mặc định 5555. Mở http://localhost:5555 sau khi khởi động; nhấn Ctrl+C để dừng. Script không tự mở trình duyệt.

Các lệnh trực tiếp tương đương khi đang ở `backend/`:

```sh
npx prisma migrate dev --name init_database
npx prisma db seed
npx prisma studio
```

Đối với database mới, các migration đã lưu sẽ được áp dụng theo thứ tự. Không sửa các file migration đã áp dụng. `migrate dev` chỉ dùng cho phát triển; môi trường triển khai dùng `npx prisma migrate deploy` và cấu hình kết nối của môi trường đó. Prisma 6 có thể tự seed khi khởi tạo migration; chạy seed tường minh thêm lần nữa vẫn không tạo bản ghi trùng.

## Dữ liệu mẫu và nghiệm thu

| Bảng | Số bản ghi mẫu | Nội dung |
| --- | ---: | --- |
| User | 2 | Tuấn (A), Linh (B) |
| Session | 2 | Phiên mẫu đã thu hồi/hết hạn |
| Trip | 1 | Hà Giang · Explore the Loop, 20/11/2026, 3 ngày, XE_MAY, 5.000.000đ |
| TripMember | 2 | Tuấn OWNER, Linh MEMBER; đều ACTIVE |
| TripInvite | 1 | Lời mời mẫu đã dùng, hết hạn |
| Stop | 9 | Kho tạm 1; ngày 1 có 3; ngày 2 có 3; ngày 3 có 2 |
| Expense | 3 | 600.000đ Homestay, 200.000đ Ăn uống, 100.000đ Vé tham quan |
| SettlementTransfer | 1 | Linh chuyển trả Tuấn 100.000đ |
| PackingItem | 8 | 4 đồ chung; 2 đồ cá nhân cho mỗi người; tổng 4/8 đã xếp |
| IdempotencyRecord | 1 | Phản hồi mẫu của thao tác tạo khoản Homestay |

- Tổng chi: **900.000đ**; ngân sách còn lại **4.100.000đ**. Chuyển trả không cộng vào tổng chi.
- Trước chuyển trả: `600.000 / 2 - 200.000 / 2 + 100.000 = 300.000đ` Linh nợ Tuấn.
- Sau chuyển trả 100.000đ: Linh còn nợ Tuấn **200.000đ**.
- Áo khoác và Giấy tờ tùy thân được lưu riêng theo từng thành viên để thể hiện đúng hai cột trong thiết kế 04. `assignedToMemberId` là người mang đồ chung hoặc chủ sở hữu đồ cá nhân.
- Chỉ Cổng trời Quản Bạ và Cột cờ Lũng Cú có tọa độ được cung cấp. Điểm khác giữ `null`; không tự điền GPS giả. Khu vực Yên Minh của Quán cơm Mẹ Nấu được ghi trong `notes`, do schema yêu cầu không có trường khu vực riêng.
- `startDate` dùng PostgreSQL `DATE` để giữ ngày khởi hành 20/11/2026. Các chuỗi `arriveTime`/`leaveTime` là giờ địa phương theo `Trip.timezone`.

Seed dùng upsert trong một transaction, ID mẫu có tiền tố `demo_`. Chạy lại sẽ cập nhật các bản ghi mẫu đó, không xóa bảng hay dữ liệu ngoài bộ mẫu. Những chỉnh sửa của bạn vào chính các bản ghi mẫu có thể được seed ghi lại về giá trị mẫu.

Các token mẫu được tạo ngẫu nhiên rồi chỉ lưu SHA-256. Session đều đã thu hồi và lời mời đã dùng/hết hạn; không sinh cookie hay liên kết đăng nhập hoạt động. `IdempotencyRecord.responseBody` biểu diễn số tiền bằng chuỗi để JSON không lỗi với JavaScript BigInt.

## Toàn vẹn dữ liệu

- Đủ 10 model, khóa ngoại và unique/index theo đặc tả.
- Khóa ngoại ghép `(tripId, stopId)` và `(tripId, memberId)` ngăn tham chiếu điểm dừng, người trả, người nhận hoặc người mang thuộc chuyến khác.
- PostgreSQL CHECK constraints trong migration riêng kiểm tra số tiền, ngân sách, ngày/thứ tự không âm, version dương, cặp GPS hợp lệ, giờ HH:mm, trạng thái/kiểu chia tiền/phương tiện, người chuyển khác người nhận.
- Xóa mềm `Stop`, `Expense`, `SettlementTransfer` bằng `deletedAt`. Các quan hệ tài chính không tự xóa theo thành viên/điểm dừng. Xóa toàn bộ Trip là thao tác xóa vật lý có cascade; không dùng cho luồng đồng bộ thông thường.
- `src/config/database.ts` xuất singleton `prisma`. Gọi `$disconnect()` khi kết thúc script; không đóng client sau từng request.

`db:verify` đọc dữ liệu từ database, đối chiếu lịch trình, tiền, hành lý và chạy 13 kiểm tra ràng buộc gồm unique, quan hệ cùng chuyến, số tiền âm, cascade Session và tombstone Stop. Các dữ liệu thử đều được rollback.

Đã có API cấp phiên/mã mời, kiểm tra quyền ACTIVE, giới hạn hai thành viên, tạo/xem chuyến đi, sao chép điểm dừng từ mẫu, thêm/xếp ngày với kiểm tra version và replay idempotency; xem [API_AUTH.md](API_AUTH.md). Frontend hiển thị mẫu chỉ đọc, không đăng nhập bằng User seed. Quyết toán và đồng bộ ngoại tuyến là bước tiếp theo. Bước giao diện không thay đổi schema/migration. Express hiện chuyển BigInt thành chuỗi thập phân bằng JSON replacer để tránh lỗi JSON và mất chính xác.

## Ghi chú phiên bản

Prisma 6 thông báo `package.json#prisma` deprecated để chuẩn bị cho Prisma 7. Đây là cảnh báo tương thích của chính cấu hình seed được yêu cầu, không phải lỗi migration hay seed.

`npm audit` hiện báo 3 mục high cùng xuất phát từ dependency dev `deepmerge-ts@7.1.5` của Prisma CLI 6 (`prisma` → `@prisma/config` → `deepmerge-ts`). [Advisory GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) mô tả lỗi khi merge object có vòng tham chiếu. Bản vá mặc định mà npm đề nghị nâng lên Prisma 7, thay đổi cú pháp cấu hình đã chỉ định. Không chạy `npm audit fix --force` tự động; việc nâng Prisma major cần cập nhật đồng bộ schema/config/client/seed và kiểm tra lại migration.
