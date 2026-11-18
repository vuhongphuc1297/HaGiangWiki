# Bước 3.2 — Tab Chi tiêu và quyết toán hai người

Mở `/?tab=expenses` hoặc chọn **Chi tiêu** trên BottomNav. Giao diện dùng API [Bước 3.1](API_EXPENSES.md), giữ hệ màu, typography, bottom sheet và khung mobile tối đa 420px hiện có; desktop cũng giữ khung này. Không thêm dependency hoặc thay đổi schema/migration.

## Sử dụng

- Thẻ **Ngân sách chuyến đi** hiển thị tổng thực chi, dự toán, còn lại hoặc số tiền vượt, cùng số tiền mỗi người đã trả. Thanh tiến độ chuyển vàng khi chi hơn 80% và đỏ khi vượt 100%; ngân sách bằng 0 có nhãn chưa đặt ngân sách.
- Thẻ **Quyết toán hai người** nêu người nợ → người nhận và số tiền ròng. **Ghi nhận chuyển trả** mở form điền sẵn hai người và toàn bộ số nợ; có thể sửa số tiền để trả một phần, thêm ghi chú chuyển khoản/tiền mặt. Khi hết nợ, thẻ hiện dấu tích và thông báo hai bạn đã sòng phẳng.
- **Các khoản chi** xếp mới nhất trước, có tên, danh mục, số tiền, người trả, nhãn Chia đôi/Chi hộ/Chi riêng và điểm dừng liên kết. **Sửa** mở dữ liệu hiện tại; **Xóa** yêu cầu xác nhận tên và số tiền sẽ loại khỏi sổ. Xóa mềm làm tổng chi và công nợ tính lại.
- Nút **Thêm khoản chi** nằm cố định phía trên BottomNav. Form nhập tên, tiền nguyên đồng, người trả đang `ACTIVE`, cách chia, danh mục và điểm dừng tùy chọn. Ba cách chia có giải thích và xem trước phần tiền từng người; chi hộ cần hai người đang tham gia. Chi riêng tăng tổng chi nhưng không tạo nợ.
- **Lịch sử chuyển trả** ghi người gửi, người nhận, số tiền, ngày và ghi chú. Nút thùng rác mở xác nhận xóa lần chuyển trả; công nợ tính lại, tổng thực chi giữ nguyên. Chuyển trả không được cộng vào chi phí chuyến đi.
- Trên mỗi thẻ **Lịch trình**, **+ Ghi chi tiêu** mở form với đúng `stopId` và gợi ý `Chi tiêu tại <tên điểm>`. Người dùng chọn danh mục và cách chia rồi lưu; khoản mới giữ liên kết điểm dừng khi xem ở tab Chi tiêu.

Lịch trình mẫu chỉ xem: tab Chi tiêu giải thích cách sử dụng và nút **Thêm khoản chi** dẫn tới tạo chuyến riêng. Không gọi API chi tiêu riêng tư hoặc ghi dữ liệu tài chính vào chuyến mẫu.

## Dữ liệu và xử lý lỗi

`features/expenses/ExpensesPage.tsx` chứa trang tổng quan; `ExpenseModals.tsx` chứa thêm/sửa/xác nhận xóa khoản chi; `SettlementModal.tsx` chứa ghi nhận/xác nhận xóa chuyển trả. `ExpenseContext.tsx` chia sẻ snapshot sổ chi tiêu, còn `ExpenseFormShared.tsx` và `expense.form.ts` dùng chung xử lý request, lỗi và số tiền. `HomePage.tsx` quản lý mở modal; `Timeline.tsx` truyền điểm dừng cho ghi nhanh.

Số tiền đi qua JSON dưới dạng chuỗi thập phân. Định dạng VND, xem trước phần chia và tính tỷ lệ ngân sách dùng `BigInt`; chỉ tỷ lệ thanh tiến độ đã giới hạn được đổi sang Number. Form nhận tiền nguyên dương tối đa `9223372036854775807`, hiển thị dấu phân nhóm VND và khai báo `inputMode="numeric"`. Summary công nợ chính thức lấy từ backend.

Sổ tải khi ứng dụng nhận chuyến/phiên hợp lệ và mỗi lần vào tab Chi tiêu, để nhận cả khoản mới được thêm khi đang xem tab khác. Sau khi ghi thành công, tải lại sổ và thông tin chuyến. Nút **Làm mới dữ liệu** trên TopBar cập nhật cả hai; cơ chế quay lại ứng dụng sau ít nhất 30 giây cũng kích hoạt cùng luồng. Không có tự động polling hoặc đồng bộ realtime. Đồng bộ nền không thay thế bản nháp đang mở; response cũ không ghi đè sổ mới hoặc dữ liệu của chuyến/phiên khác.

Lỗi mạng/server khi tải lại giữ snapshot đã có và hiện nút thử lại; lỗi truy cập 401/403/404 xóa dữ liệu tài chính khỏi màn hình. Đây là dữ liệu trong bộ nhớ khi trang còn mở, không phải cache ngoại tuyến bền vững.

Mỗi thao tác ghi gửi UUIDv4 `Idempotency-Key`; retry cùng đường dẫn, phương thức và nội dung trong form dùng lại key. Trong khi gửi, khóa thao tác lặp và đóng modal. Lưu đã thành công nhưng tải lại lỗi không được báo thành thất bại ghi để tránh khuyến khích gửi thêm khoản mới.

Sửa/xóa khoản chi gửi version của snapshot lúc mở. Nếu người kia đã sửa trước, HTTP 409 giữ bản nháp và hiện cảnh báo, khóa gửi tiếp. Chọn **Làm mới dữ liệu** sẽ đóng form và tải bản hiện hành; mở lại khoản chi để sửa tiếp. Lỗi nhập liệu nằm cạnh trường, focus trường đầu tiên chưa hợp lệ; sửa trường sẽ xóa lỗi tương ứng.

## Kiểm chứng

Luồng trình duyệt dùng hai phiên cookie độc lập, A **Tuấn3.2** và B **Linh3.2**:

| Thao tác | Công nợ B → A |
| --- | --- |
| A trả Homestay 600.000đ, chia đôi | 300.000đ |
| B trả Ăn trưa 200.000đ, chia đôi | 200.000đ |
| A trả Vé thuyền 100.000đ, chi hộ B | 300.000đ |
| B chuyển trả A 100.000đ | 200.000đ |
| Thêm chi riêng 55.001đ | 200.000đ; tổng chi 955.001đ |

Đã kiểm tra ghi nhanh tại **Cột cờ**, lưu 16.000đ chi riêng và giữ đúng liên kết điểm; sửa với version cũ nhận 409, giữ nháp rồi tải lại/mở sửa; xóa khoản chi và chuyển trả tính lại công nợ. Chuyển trả đủ 200.000đ đưa về sòng phẳng, xóa lần trả đó đưa nợ về 200.000đ. Ngân sách đã được thử ở 90% (vàng), 112% (đỏ), sau đó khôi phục 5.000.000đ.

Đối chiếu trong Chromium in-app browser ở 390×844, 320×740 và 1440×960 với hệ thiết kế hiện có và [bản chi tiêu 03](../design/mockups/03-chi-tieu-va-quyet-toan.png). Đây là kiểm tra bố cục/trải nghiệm trình duyệt, không khẳng định khớp ảnh từng pixel hoặc kiểm chứng bàn phím/thiết bị di động vật lý. Ảnh, trạng thái và hash nguồn nằm tại `tmp/expenses-verification/visual-evidence.json` (artifact cục bộ).

Chạy từ thư mục gốc, với PostgreSQL sẵn sàng theo [DATABASE.md](DATABASE.md):

```sh
npm run typecheck
npm run build
npm run test:expenses
npm run test:auth
npm run test:stops
npm run test:sync
npm run test:expense-ui
```

Bốn bộ hồi quy hiện có đạt 81/81 kiểm tra (expenses 17, auth 30, stops 25, sync 9); typecheck và build toàn dự án thành công. `test:expense-ui` đạt 3/3 kiểm tra helper nhập/định dạng/giới hạn tiền, không cần database; kiểm tra luồng người dùng ở trên được thực hiện trên giao diện thật. Chuyến và hai tài khoản riêng của lượt nghiệm thu này đã được đối chiếu rồi dọn bằng đúng ID; dữ liệu seed và các chuyến khác được giữ nguyên.
