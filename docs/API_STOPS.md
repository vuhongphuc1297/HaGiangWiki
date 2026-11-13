# HaGiangWiki — Điểm dừng và cấu hình chuyến đi (Bước 2.1)

Các API dưới đây cần cookie session hợp lệ và membership ACTIVE qua `tripAccess`. Chỉ OWNER được sửa cấu hình chuyến đi. Không thay đổi schema hoặc migration.

## Sửa điểm dừng

`PATCH /api/trips/:tripId/stops/:stopId`

```json
{
  "name": "Cổng trời Quản Bạ",
  "category": "Ngắm cảnh",
  "day": 2,
  "arriveTime": "09:30",
  "leaveTime": "10:30",
  "estimatedCost": 60000,
  "notes": "Mang áo khoác",
  "latitude": 23.0567,
  "longitude": 104.9876,
  "version": 1
}
```

Chỉ `version` là bắt buộc, phải là số nguyên từ 1. Các trường bỏ qua được giữ nguyên, kể cả ngày và số tiền. Giới hạn:

- `name`: trim, 1–160 ký tự; `category`: trim, 1–60 ký tự hoặc null; `notes`: trim, tối đa 2000 ký tự hoặc null.
- `day`: số nguyên từ 0 đến `durationDays`; 0 là kho tạm. Khi chuyển ngày, điểm được nối vào cuối ngày đích; ngày nguồn được dồn thứ tự.
- `arriveTime`/`leaveTime`: `HH:mm` hoặc null.
- `estimatedCost`: số nguyên an toàn JavaScript không âm. Response biểu diễn số tiền bằng chuỗi thập phân.
- `latitude`: −90 đến 90; `longitude`: −180 đến 180. Cặp tọa độ sau khi cập nhật phải cùng có giá trị hoặc cùng null. Có thể sửa riêng một tọa độ khi tọa độ còn lại đã tồn tại.

Trả 200 điểm dừng mới, tăng `Stop.version` một lần và `Trip.version` một lần. Nếu version cũ, trả 409 và không ghi dữ liệu:

```json
{
  "error": "Điểm dừng vừa được thay đổi trên thiết bị khác. Vui lòng tải lại trước khi sửa tiếp.",
  "currentVersion": 2
}
```

Điểm không tồn tại, thuộc chuyến khác hoặc đã xóa mềm trả 404.

## Xóa mềm

`DELETE /api/trips/:tripId/stops/:stopId`

Gửi JSON `{ "version": 2 }` hoặc query `?version=2`. Nếu gửi cả hai, chúng phải trùng nhau. Thiếu version hoặc sai kiểu trả 400; version cũ trả 409 với payload như trên.

Trả 200 bản ghi đã đặt `deletedAt` và tăng version. Không xóa vật lý điểm dừng hoặc khoản chi liên kết. Các điểm còn hoạt động trong cùng ngày được đánh lại `orderIndex` từ 1, chỉ điểm có thứ tự thay đổi mới tăng version. Tăng `Trip.version` một lần. Danh sách từ `GET /api/trips/:tripId` không chứa điểm đã xóa.

## Sắp xếp an toàn

`PATCH /api/trips/:tripId/stops/reorder`

```json
{ "day": 1, "stopIds": ["stop-c", "stop-a", "stop-b"] }
```

`day` là số nguyên không âm và không vượt thời lượng chuyến đi. `stopIds` là mảng không rỗng, không trùng ID, chứa **toàn bộ** điểm chưa xóa của ngày đó. Áp dụng cả kho tạm `day = 0`.

Transaction khóa Trip trước, sau đó khóa các điểm trong ngày bằng `SELECT ... FOR UPDATE`. Mọi ID phải thuộc đúng chuyến, đúng ngày, chưa xóa. Dữ liệu không hợp lệ trả 400. Danh sách thiếu điểm, bao gồm trường hợp thiết bị khác vừa thêm/chuyển điểm vào ngày, trả 409 để client tải lại danh sách đầy đủ. Lỗi không làm thay đổi một phần thứ tự hoặc version.

Trả 200 mảng điểm theo đúng thứ tự `stopIds`. `orderIndex` được gán từ 1 đến N; mỗi điểm tăng version một lần, Trip tăng version một lần. Reorder đồng thời được xử lý tuần tự; kết quả cuối là một thứ tự hoàn chỉnh của request được xử lý sau. Client có thể dùng Idempotency-Key để retry cùng thao tác.

## Sửa cấu hình chuyến đi và giảm ngày

`PATCH /api/trips/:tripId` — chỉ OWNER đang ACTIVE.

```json
{
  "title": "Hà Giang cuối tuần",
  "startDate": "2026-11-20",
  "durationDays": 2,
  "vehicle": "XE_MAY",
  "budget": 5000000,
  "version": 6
}
```

Chỉ `version` là bắt buộc. `title` trim, 1–200 ký tự; ngày hợp lệ `YYYY-MM-DD`; `durationDays` số nguyên 1–30; `vehicle` nhận `XE_MAY`, `O_TO`, `MAY_BAY`; `budget` là số nguyên an toàn JavaScript không âm. Trường bỏ qua được giữ nguyên. Version cũ trả 409 kèm `currentVersion` của Trip.

Trong cùng transaction, sau khi khóa Trip và kiểm tra lại quyền/version:

1. Khi giảm ngày, tìm mọi điểm chưa xóa có `day > durationDays` mới, giữ thứ tự theo ngày cũ, thứ tự cũ và ID.
2. Chuyển các điểm đó sang `day = 0`, nối sau `orderIndex` lớn nhất của kho tạm đang hoạt động. Mỗi điểm được chuyển tăng version một lần; mọi thông tin khác và liên kết khoản chi được giữ nguyên. Điểm đã xóa mềm không bị chuyển hoặc khôi phục.
3. Lưu cấu hình và tăng `Trip.version` một lần. Trả 200 thông tin Trip mới, `members`, `stops` chưa xóa và `movedStopsCount` (0 khi không có điểm chuyển).

Các thao tác thêm/sửa/xóa/sắp xếp điểm dừng đều dùng khóa Trip trước khi đọc/ghi lịch trình. Vì thế giảm ngày đồng thời với thêm/chuyển điểm không để lại điểm hoạt động nằm ngoài thời lượng mới; request còn lại có thể nhận 400 hoặc 409 và cần tải lại.

## Retry và kiểm thử

Tất cả API ghi ở trên hỗ trợ header tùy chọn `Idempotency-Key`. Dùng key mới cho mỗi thao tác; giữ nguyên key/method/URL/body khi retry. Replay không tăng version, không dồn thứ tự hoặc chuyển điểm thêm lần nữa. Response và cache chỉ được gửi/lưu sau commit; lỗi rollback toàn bộ. Quyền truy cập vẫn được kiểm tra trước replay.

Từ thư mục gốc, với PostgreSQL và `backend/.env` đã cấu hình:

```sh
npm run test:stops
npm run test:auth
npm run typecheck
```

`test:stops` chạy HTTP trên cổng ngẫu nhiên với PostgreSQL thật, tự tạo rồi dọn dữ liệu có UUID riêng; không sửa seed hoặc reset database. Bộ test kiểm tra sửa, stale version, xóa mềm giữ khoản chi, dồn thứ tự, reorder, giảm ngày, quyền OWNER/ACTIVE, validation, idempotency, ghi đồng thời và rollback. Kết quả nghiệm thu: `test:stops` 25 pass/0 fail; `test:auth` 30 pass/0 fail; typecheck toàn monorepo không có lỗi.
