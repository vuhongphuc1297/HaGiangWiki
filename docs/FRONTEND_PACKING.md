# Hành trang cá nhân — Bước 3.3 / M2

Mở `/?tab=packing`. Danh sách hoàn toàn riêng cho người đang đăng nhập trong chuyến hiện tại; người đồng hành có balo riêng. Chế độ mẫu chỉ giải thích và dẫn sang tạo chuyến đi, không gọi API packing để hiển thị dữ liệu seed.

- Thẻ tiến độ hiển thị số món đã chuẩn bị/tổng số và phần trăm. Khi mọi món đều đã xếp và danh sách có ít nhất một món, thẻ chuyển nền xanh nhạt và báo “Bạn đã chuẩn bị đầy đủ hành trang lên đường!”. Danh sách rỗng hiển thị 0%, không báo hoàn thành.
- Checkbox native 24×24px, vùng nhãn chạm tối thiểu 44px. Chạm vào nhãn hoặc checkbox đổi dấu tích, gạch ngang/làm mờ tên và tính lại tiến độ ngay, rồi PATCH ngầm. Trong lúc lưu khóa thao tác tiếp để tránh gửi version cũ; hàng đang lưu và TopBar báo trạng thái.
- Ô **Thêm vào balo** nằm trên BottomNav, nhận tên 1–160 ký tự, thêm bằng nút hoặc Enter. Chỉ xóa nội dung sau khi lưu thành công; lỗi giữ nguyên nội dung để thử lại.
- Bút chì mở form đổi tên; lỗi tên trống focus đúng ô, sửa lại xóa message và `aria-invalid`. Thùng rác mở xác nhận với tên món đồ. Dialog giữ focus, hỗ trợ Escape và chặn đóng khi đang lưu. Xóa thành công cập nhật danh sách/thống kê.
- **Nạp gợi ý đồ phượt Hà Giang** thêm bảy món thiết yếu vào balo của chính người bấm. Nạp lại không tạo trùng, không bỏ dấu tích hoặc sửa đồ đã có. Thông báo nêu số món được thêm.

## Đồng bộ và phục hồi

PackingProvider giữ dữ liệu trong bộ nhớ, phạm vi gồm user ID, trip ID và member ID ACTIVE. Khi đổi tài khoản/chuyến hoặc đăng xuất, danh sách cũ được che ngay lúc render rồi xóa; phản hồi cũ bị bỏ qua. Không lưu hành trang hoặc token trong localStorage.

Vào tab, bấm làm mới hoặc luồng quay lại ứng dụng của TripContext sẽ tải GET mới. GET bắt đầu trước PATCH không được ghi đè dấu tích lạc quan; yêu cầu refresh đến trong lúc đang ghi được thực hiện sau khi ghi xong. Không thêm polling/realtime hoặc cache ngoại tuyến.

Lỗi mạng khi tích chọn hoàn tác dấu tích và tiến độ, giữ danh sách, hiện lỗi để thử lại. Lần thử lại cùng thao tác chưa rõ kết quả dùng lại Idempotency-Key. Nếu server đã tạo đồ nhưng response bị mất, replay sau refresh cập nhật cùng ID, không nhân đôi hàng trên màn hình. Lỗi đọc tạm thời giữ snapshot, còn 401/403/404 xóa snapshot không còn truy cập được.

Lỗi 409 hoàn tác dấu tích nếu có, tải lại danh sách và thông báo món đồ đã thay đổi trên thiết bị khác. Form đổi tên/xóa giữ bản nháp, khóa gửi bản cũ và cho chọn **Xem bản mới** để đóng form; mở lại lấy version mới. API chi tiết tại [API_PACKING.md](API_PACKING.md).

## Kết quả nghiệm thu M2

| Lệnh | Kết quả |
| --- | --- |
| `npm run typecheck` | Backend và frontend đạt |
| `npm run build` | Backend và bundle frontend đạt |
| `npm run test:packing` | 15/15 |
| `npm run test:packing-ui` | 9/9 |
| `npm run test:expenses` | 17/17 |
| `npm run test:auth` | 30/30 |
| `npm run test:stops` | 25/25 |
| `npm run test:sync` | 9/9 |
| `npm run test:expense-ui` | 3/3 |

Tổng 108 kiểm thử. Bộ packing UI dùng phản hồi deferred để kiểm chứng đổi dấu tích ngay trước khi HTTP hoàn tất, double tap, rollback và retry cùng key, response GET cũ, refresh trong khi ghi, logout/đổi user, 409, lỗi quyền truy cập và replay create sau khi tải lại.

Đã thử với hai phiên cookie độc lập trong Chromium: A tại `[::1]:5173`, B tại `127.0.0.2:5174`. A tạo ba món và tích một món (33%); B mở balo rỗng, tạo món riêng và tích hoàn tất (100%). A tải lại vẫn không thấy đồ B. A đổi tên thành công, mở hai cửa sổ sửa cùng món và phục hồi 409; kiểm tra validation → sửa → Escape trả focus, mở/hủy xác nhận xóa. Xóa thực tế được kiểm tra trong bộ HTTP. A nạp template hai lần còn đúng mười món (ba món riêng + bảy gợi ý), B tải lại vẫn chỉ có một món. PostgreSQL đối chiếu ownership, version, tiến độ và chống trùng.

Đã kiểm tra kích thước CSS viewport 320×740, 390×844 và 1440×960: không tràn ngang, tên gợi ý dài xuống dòng, form/nút truy cập được bằng cuộn, khung 420px và thanh cố định thẳng hàng trên desktop. Giữ hệ giấy ấm, chữ serif và xanh rừng hiện có, đối chiếu bản `04-hanh-ly-cai-dat-va-dong-hanh.png`; yêu cầu chỉ có đồ riêng được ưu tiên hơn phần đồ chung trong mockup cũ. Không có lỗi console ở cửa sổ kiểm tra cuối.

Ảnh, số đo DOM, đối chiếu DB và receipt SHA-256 nằm ở `tmp/packing-verification/visual-evidence.json` (artifact cục bộ, không commit). Đây là hai phiên cookie tách biệt trong trình duyệt được công cụ hỗ trợ, không phải hai ứng dụng trình duyệt khác nhau. Chưa thử bàn phím trên điện thoại vật lý hoặc đo FPS. Schema/migrations và dữ liệu seed giữ nguyên.
