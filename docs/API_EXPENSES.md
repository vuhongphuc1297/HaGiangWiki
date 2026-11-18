# Bước 3.1 — Expense API và quyết toán hai người

Backend dùng các model `Expense`, `SettlementTransfer` và `IdempotencyRecord` hiện có. Không thay đổi schema hoặc migration.

## Xác thực và đường dẫn

Tất cả endpoint dùng cookie `session_token` và middleware `tripAccess`; chỉ thành viên `ACTIVE` được truy cập. Người ngoài hoặc thành viên `REVOKED` nhận 403, thiếu/không có phiên hợp lệ nhận 401.

| Method | Đường dẫn | Kết quả |
| --- | --- | --- |
| GET | `/api/trips/:tripId/expenses` | 200: `{ expenses, settlements, summary }` |
| POST | `/api/trips/:tripId/expenses` | 201: khoản chi mới |
| PATCH | `/api/trips/:tripId/expenses/:expenseId` | 200: khoản chi đã sửa, version tăng 1 |
| DELETE | `/api/trips/:tripId/expenses/:expenseId` | 200: khoản chi đã xóa mềm, version tăng 1 |
| POST | `/api/trips/:tripId/settlements` | 201: giao dịch chuyển trả mới |
| DELETE | `/api/trips/:tripId/settlements/:settlementId` | 200: giao dịch đã xóa mềm |

## Tạo và sửa khoản chi

POST bắt buộc có header `Idempotency-Key` là UUIDv4, ví dụ `1feb9f41-4b32-4a85-8ba9-bbd562b6fe17`. Body:

```json
{
  "title": "Homestay",
  "amount": "600000",
  "payerMemberId": "member_a_id",
  "splitType": "EQUAL",
  "stopId": null,
  "category": "Lưu trú"
}
```

- `title`: sau trim dài 1–160 ký tự; `payerMemberId` phải thuộc chuyến đi và đang `ACTIVE`.
- `amount`: số nguyên **lớn hơn 0**, theo CHECK constraint hiện có. Nhận JSON number an toàn (`<= Number.MAX_SAFE_INTEGER`) hoặc chuỗi thập phân nguyên dương không có số 0 ở đầu; tối đa `9223372036854775807` của PostgreSQL bigint. Dùng chuỗi cho số tiền lớn.
- `splitType`: `EQUAL` (mặc định), `FOR_OTHER`, `PERSONAL`.
- `stopId`: tùy chọn hoặc null; khi cung cấp ID phải thuộc đúng chuyến đi và chưa bị xóa mềm.
- `category`: tùy chọn hoặc null, sau trim dài 1–60 ký tự.

PATCH nhận các trường trên dưới dạng tùy chọn, cùng `version` dạng JSON number nguyên dương bắt buộc. Các trường bị bỏ qua giữ nguyên. `stopId`/`category` có thể xóa bằng null. Một điểm dừng bị xóa mềm vẫn giữ các khoản chi cũ; sửa tiêu đề khoản chi đó không cần gửi lại `stopId`.

DELETE khoản chi bắt buộc có body `{ "version": 1 }` hoặc query `?version=1`; nếu cung cấp cả hai thì phải giống nhau. Version cũ trả 409 cùng `{ "error": "...", "currentVersion": 2 }`, kể cả khi một request khác vừa xóa khoản chi. Không sửa lại được tombstone bằng version hiện hành (404).

## Chuyển trả

POST yêu cầu `Idempotency-Key` UUIDv4 và body:

```json
{
  "fromMemberId": "member_b_id",
  "toMemberId": "member_a_id",
  "amount": "100000",
  "notes": "CK Vietcombank"
}
```

Hai thành viên phải khác nhau, cùng chuyến đi và đều `ACTIVE`. `amount` dùng cùng quy tắc với khoản chi; `notes` tùy chọn/null, tối đa 2.000 ký tự. Có thể trả dư: công nợ sẽ đổi chiều. DELETE chuyển trả không yêu cầu version vì model hiện có không chứa trường này.

## Kết quả và cách tính

Mọi số tiền trong response, bao gồm `amount`, `budget`, `totalSpent`, `remainingBudget`, `spentByMember` và `netAmount`, là **chuỗi thập phân** qua `bigintJsonReplacer`. Phép tính chỉ dùng `BigInt`.

- `totalSpent` cộng tất cả khoản chi chưa xóa, gồm cả `PERSONAL`.
- `spentByMember` là tổng tiền từng người đã ứng trả, gồm cả chi riêng; thành viên chưa chi có giá trị `"0"`.
- `remainingBudget = budget - totalSpent`, có thể âm khi vượt ngân sách.
- `EQUAL`: phần người kia chịu là `amount / 2n`; người trả chịu phần còn lại. Ví dụ 101.000đ chia 50.500đ/50.500đ; 101.001đ chia 50.501đ cho người trả và 50.500đ cho người kia. Luôn bảo toàn đủ số đồng.
- `FOR_OTHER`: người kia nợ người trả toàn bộ số tiền. Tạo/sửa khoản chi hộ cần hai thành viên `ACTIVE`.
- `PERSONAL`: không phát sinh công nợ.
- Chuyển trả từ người nợ sang người được trả giảm nợ đúng số tiền, không cộng vào tổng chi hoặc `spentByMember`.
- Xóa mềm khoản chi/chuyển trả làm phép tính kế tiếp loại bỏ bản ghi đó ngay.
- Khi hết nợ: `netAmount: "0"`, `isSettled: true`, `debtorMemberId` và `creditorMemberId` đều null.

Sổ quyết toán hỗ trợ tối đa hai thành viên trong toàn bộ lịch sử. Thành viên `REVOKED` vẫn được giữ trong phép tính để bảo toàn công nợ cũ, dù không được truy cập hoặc chọn cho giao dịch mới. Nếu lịch sử đã có hơn hai thành viên, API trả 409 để tránh gán nhầm người hưởng phần chia. Chuyến đi chỉ có một thành viên vẫn ghi được `PERSONAL`/`EQUAL`; chưa phát sinh nợ. Khi người thứ hai tham gia, các khoản `EQUAL` được tính lại theo cặp thành viên của chuyến đi.

Kịch bản chuẩn: A trả 600k chia đôi, B trả 200k chia đôi, A chi hộ B 100k, B trả A 100k ⇒ tổng chi `"900000"`, A đã trả `"700000"`, B đã trả `"200000"`, B còn nợ A `"200000"`.

## Idempotency và đồng thời

POST bắt buộc key; PATCH và cả hai DELETE hỗ trợ key UUIDv4 tùy chọn. Dùng middleware idempotency hiện có, cache kết quả thành công 24 giờ, cùng transaction với bản ghi tài chính. Retry cùng người dùng/đường dẫn/nội dung đã chuẩn hóa/key trả cùng status/body, header `X-Cache: HIT`; lần đầu là `MISS`. Dùng lại key cho người dùng, thao tác hoặc nội dung khác trả 409. Request lỗi không lưu cache hoặc dữ liệu trung gian. Khóa unique ở model tiếp tục ngăn tạo lại giao dịch cùng key sau khi cache hết hạn (409).

Mọi mutation khóa Trip trước, kiểm tra lại quyền trong transaction, giữ khóa chia sẻ trên thành viên rồi khóa khoản chi/chuyển trả liên quan. Điều này phối hợp với thứ tự khóa của API điểm dừng/chuyến đi; mỗi mutation thành công tăng cả `Trip.version`. GET dùng snapshot `RepeatableRead` để ngân sách, hai danh sách và summary nhất quán.

## Kiểm thử

Chạy từ thư mục gốc, với PostgreSQL trong `backend/.env` đang hoạt động:

```sh
npm run typecheck
npm run test:expenses
npm run test:auth
npm run test:stops
npm run test:sync
```

`test:expenses` chạy Node test runner qua `tsx`, gồm 17 test (hai test hàm thuần, 14 kịch bản tích hợp và test cha). Bao phủ CRUD, ba kiểu chia, kịch bản chuẩn, tiền lẻ/số lớn, ngân sách âm, chuyển dư, xóa mềm, quyền ACTIVE, liên kết khác chuyến, retry đồng thời, xung đột version và rollback transaction. Fixture dùng ID riêng và tự dọn dữ liệu đã tạo; không seed/reset/migrate database.
