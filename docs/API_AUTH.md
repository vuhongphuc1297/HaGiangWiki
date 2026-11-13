# HaGiangWiki — API xác thực, chuyến đi và lời mời

## Chạy và kiểm thử

PostgreSQL cần hoạt động và `backend/.env` phải có `DATABASE_URL`. Dùng schema/migration đã có; bước API này không thêm bảng hoặc thay đổi migration.

Từ thư mục gốc:

```sh
npm run dev
npm run test:auth
npm run typecheck
npm run build
```

`test:auth` tự tạo HTTP server ở một cổng ngẫu nhiên trên `127.0.0.1`, chạy request thật với PostgreSQL, rồi đóng server và dọn riêng dữ liệu có ID/prefix UUID của lần chạy. Không dùng cổng 5000/5173, không reset database, không thay dữ liệu seed Hà Giang. Các endpoint `/_checks` chỉ có trong HTTP server của test, không đăng ký trong ứng dụng thực tế.

## Các endpoint đã hoạt động

| Method | Endpoint | Quyền và kết quả |
| --- | --- | --- |
| POST | `/api/auth/register-anonymous` | Body `{ "displayName": "Tuấn" }`; tạo User + Session; trả 201 `{ id, displayName }` và cookie |
| GET | `/api/auth/me` | Cần session; trả `{ user: { id, displayName }, trips }`; mỗi trip có `membership`, chỉ lấy ACTIVE |
| POST | `/api/auth/logout` | Thu hồi session hiện tại, xóa cookie; trả `{ success: true }`; gọi khi chưa đăng nhập vẫn hợp lệ |
| POST | `/api/trips` | Cần session; tạo Trip + thành viên OWNER trong một transaction; trả 201 thông tin Trip kèm `members` |
| GET | `/api/trips/:tripId` | Cần session và thành viên ACTIVE; trả thông tin Trip, `members` và `stops` chưa xóa mềm |
| PATCH | `/api/trips/:tripId` | OWNER đang ACTIVE; kiểm tra version; giảm ngày chuyển điểm vượt thời lượng về kho tạm; trả thêm `movedStopsCount` |
| GET | `/api/trips/demo_trip_hagiang_20261120` | Ngoại lệ công khai chỉ cho đúng chuyến seed; trả `readOnly: true`, không trả userId hoặc thông tin phiên |
| POST | `/api/trips/:tripId/stops` | Thành viên ACTIVE; thêm địa điểm, trả 201; hỗ trợ Idempotency-Key |
| PATCH | `/api/trips/:tripId/stops/reorder` | Thành viên ACTIVE; body `{ day, stopIds }` chứa đầy đủ điểm chưa xóa trong ngày; khóa và sắp xếp trong transaction |
| PATCH | `/api/trips/:tripId/stops/:stopId` | Thành viên ACTIVE; sửa thông tin hoặc chuyển ngày, bắt buộc `version`; hỗ trợ Idempotency-Key |
| DELETE | `/api/trips/:tripId/stops/:stopId` | Thành viên ACTIVE; `version` ở body hoặc query; xóa mềm và dồn thứ tự cùng ngày |
| POST | `/api/trips/:tripId/invites` | Chỉ OWNER đang ACTIVE; trả 201 `{ inviteToken, inviteUrl, expiresAt }` |
| GET | `/api/invites/:token` | Công khai; trả preview `{ valid, tripTitle, ownerName, durationDays }` hoặc `{ valid: false, message }` |
| POST | `/api/invites/:token/join` | Body `{ "displayName": "Linh" }`; dùng session hợp lệ hiện có hoặc tạo User + Session; trả `{ success: true, tripId, memberId }` |

Danh sách thành viên trả `id`, `userId`, `nickname`, `displayName`, `role`, `status` và các mốc tham gia/thu hồi. Không trả session hoặc token hash. `stops` sắp xếp theo `day`, `orderIndex`, rồi `id` để thứ tự ổn định.

Body tạo chuyến đi:

```json
{
  "title": "Hà Giang · Explore the Loop",
  "startDate": "2026-11-20",
  "durationDays": 3,
  "vehicle": "XE_MAY",
  "budget": 5000000
}
```

- `title` được trim, từ 1–200 ký tự; `displayName` được trim, từ 1–50 ký tự.
- `startDate` là ngày hợp lệ `YYYY-MM-DD`; `durationDays` từ 1–30, mặc định 3.
- `vehicle`: XE_MAY, O_TO hoặc MAY_BAY; mặc định XE_MAY.
- `budget` tùy chọn, là số nguyên không âm trong giới hạn số nguyên an toàn JavaScript; bỏ qua sẽ lưu 0.
- `templateId` tùy chọn, chỉ nhận `demo_trip_hagiang_20261120`. Sao chép 9 điểm dừng chưa xóa vào chuyến mới có một OWNER; không sao chép thành viên/tài chính/hành lý/phiên/mã mời. Điểm có ngày vượt thời lượng mới được đưa về kho (`day = 0`). Thiếu seed trả 404.
- Các trường tiền BigInt trong response là **chuỗi**, ví dụ `"budget": "5000000"`. Express dùng JSON replacer, không sửa `BigInt.prototype` toàn cục.

Body thêm điểm dừng gồm `name` (1–160 ký tự), `category` tùy chọn (1–60), `day` (0–durationDays, mặc định 0), `arriveTime`/`leaveTime` (`HH:mm` hoặc null), `estimatedCost` (số nguyên an toàn không âm, mặc định 0), `notes` tùy chọn (tối đa 2000) và cặp `latitude`/`longitude`. Các thao tác ghi khóa Trip, kiểm tra lại membership và tăng version của Trip. Sửa/xóa sai version trả 409 kèm `currentVersion`; điểm không thuộc chuyến hoặc đã xóa trả 404. Xem [API_STOPS.md](API_STOPS.md) để biết chi tiết sửa, xóa, sắp xếp và giảm số ngày.

Route công khai của mẫu được đăng ký trước middleware xác thực và chỉ khớp ID cố định trên. Các chuyến thật vẫn yêu cầu session và membership ACTIVE. Các API ghi vẫn yêu cầu quyền, kể cả khi biết ID mẫu.

## Cookie và phiên làm việc

Cookie `session_token` có `HttpOnly`, `SameSite=Lax`, `Path=/`, thời hạn 30 ngày. Có `Secure` khi `NODE_ENV=production`, vì vậy môi trường production cần HTTPS. Database chỉ giữ SHA-256 token; raw token chỉ đi qua cookie, không đưa vào JSON user/session.

Mỗi request có cookie hợp lệ sẽ kiểm tra session còn hạn, chưa bị thu hồi. `lastUsedAt` chỉ cập nhật khi lần dùng trước cách hiện tại hơn 5 phút. Không có cookie hoặc cookie không hợp lệ sẽ để `req.user`/`req.session` là `null`.

Frontend gọi API bằng `fetch` cần `credentials: 'include'`. CORS cho phép `CLIENT_URL` và credentials, đồng thời expose `X-Cache`. Các API auth/trip/invite trả `Cache-Control: no-store` và `Referrer-Policy: no-referrer`.

## Mã mời dùng một lần và giới hạn hai người

Token mời ngẫu nhiên 32 byte, dạng 64 ký tự hex; chỉ lưu hash trong `TripInvite`. Có hiệu lực **48 giờ** theo yêu cầu API này. `inviteUrl` có dạng `${CLIENT_URL}/join/${token}`; frontend đã có màn hình preview, nhập tên và tham gia tại `/join/:token`.

Luồng join khóa bản ghi Trip trước, rồi khóa TripInvite bằng `SELECT ... FOR UPDATE`. Điều kiện hết hạn, đã dùng, đã thu hồi và quyền OWNER của người tạo được kiểm tra lại trong transaction. Tạo user/session/member và đánh dấu `usedAt` cùng commit hoặc cùng rollback; cookie chỉ được gắn sau khi commit thành công.

- Hai request dùng cùng token: chỉ một lần thành công.
- Hai token khác nhau của cùng trip: khóa Trip giữ tổng số thành viên ACTIVE tối đa hai người.
- Người dùng đã có session: giữ nguyên User và cookie, không đổi tên User; dùng `displayName` trong body làm nickname khi tạo membership mới.
- Đã là thành viên ACTIVE: dùng lại membership, vẫn tiêu thụ token mời.
- Membership REVOKED: từ chối 403, không âm thầm kích hoạt lại.
- MEMBER không tạo được mã mời; OWNER cũng không tạo thêm lời mời khi trip đã đủ hai người.
- Preview token không hợp lệ trả 200 với `valid: false`. Join token không hợp lệ trả 400; trip đã đủ người trả 409.

## Chống gửi trùng

Tạo/sửa chuyến đi và thêm/sửa/xóa/sắp xếp điểm dừng hỗ trợ header tùy chọn `Idempotency-Key`. Chấp nhận 1–200 ký tự ASCII gồm chữ, số, `.`, `_`, `:` và `-`. Nên tạo UUID mới cho mỗi thao tác và dùng lại cùng key khi retry chính thao tác đó.

- Cùng user + key + method/URL/body hợp lệ: trả lại đúng status/body đã lưu, có `X-Cache: HIT`.
- Request đầu thành công có `X-Cache: MISS`; kết quả giữ 24 giờ.
- Key còn hạn nhưng payload khác: 409; không chạy lại controller.
- User khác không nhận response của user đã dùng key; membership đã bị thu hồi không được replay dữ liệu của trip.
- Hash body dùng JSON có thứ tự key ổn định sau Zod validation; số tiền trong cache cũng được serialize thành chuỗi.

Khi tạo trip chưa có tripId, khóa lưu trữ được thêm namespace nội bộ `create-trip␟` và được tìm theo userId. PostgreSQL transaction advisory lock tuần tự hóa các request cùng user/key. Sau controller, response 2xx được capture và ghi vào `IdempotencyRecord` cùng transaction tạo Trip + OWNER. Chỉ gửi JSON sau commit. Response lỗi hoặc lỗi DB làm rollback toàn bộ, không để lại cache hoặc Trip dở dang.

Khi tái sử dụng middleware cho API JSON thuộc trip trong tương lai, thứ tự là `requireAuth` → `tripAccess` → validation → `idempotency` → controller. Service phải dùng `req.transaction` qua `inTransaction(...)`; không dùng Prisma singleton để ghi bên ngoài transaction đang được middleware mở. Không áp dụng middleware lưu response cho endpoint trả secret/cookie như tạo session hoặc mã mời.

## Lỗi và kết quả nghiệm thu

| HTTP | Trường hợp |
| --- | --- |
| 400 | Zod validation kèm `details` theo field, JSON lỗi, mã mời không hợp lệ |
| 401 | Thiếu session, session hết hạn hoặc bị thu hồi |
| 403 | Không có membership ACTIVE, sai quyền OWNER, cố tham gia lại sau thu hồi |
| 409 | Prisma P2002, Idempotency-Key xung đột, trip đã đủ hai người |
| 500 | Lỗi bất ngờ; chỉ trả thông điệp an toàn, không lộ SQL/stack/secret |

Error handler dùng chung cho response thông thường và response được hoãn bởi transaction. Chỉ gửi lỗi sau rollback. Bộ test gồm luồng A → tạo trip → mời B → B tham gia → xem trip → từ chối dùng lại mã → chặn C, cùng các ca session hết hạn/thu hồi, role OWNER, validation, throttle, race condition, rollback và BigInt.

Ca kiểm tra rollback cố ý gây lỗi Prisma P2002 và lỗi 500; log lỗi tương ứng trong lúc chạy test là kết quả mong đợi. Kết quả nghiệm thu đọc ở phần tổng kết `pass 30`, `fail 0`. Các ca mới bao gồm preview mẫu không đăng nhập, bản sao riêng, thêm/xếp điểm dừng, replay và từ chối version cũ/truy cập khác chuyến.

Frontend đã kết nối cookie session, tạo chuyến đi, lịch trình/kho, thêm/xếp điểm dừng và lời mời; xem [FRONTEND.md](FRONTEND.md). Backend đã có API sửa/xóa/sắp xếp điểm dừng và cấu hình chuyến đi; xem [API_STOPS.md](API_STOPS.md). Ghi chi tiêu, tính công nợ, thu hồi thành viên/mã mời và đồng bộ ngoại tuyến là các bước tiếp theo. Dữ liệu đã có các cột thu hồi và API hiện tại tôn trọng trạng thái đó khi chúng được cập nhật.
