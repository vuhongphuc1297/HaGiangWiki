# HaGiangWiki — Giao diện mobile bước 1.4 và 2.2

## Chạy và thử luồng hai người

PostgreSQL, migration và seed cần sẵn sàng theo [DATABASE.md](DATABASE.md). Từ thư mục gốc:

```sh
npm run install:all
npm run dev
```

Mở http://localhost:5173. Trang chủ gọi `/api/auth/me`; khách chưa có phiên hoặc người chưa có chuyến sẽ thấy chuyến mẫu `demo_trip_hagiang_20261120`, gồm kho 1 điểm và các ngày 3/3/2 điểm. Chuyến mẫu chỉ để xem vì hai thành viên Tuấn/Linh trong seed đã có sẵn, không có cookie đăng nhập hoạt động.

1. Chọn **Dùng lịch trình này**, nhập tên của bạn và tạo chuyến đi. Có thể đổi tên chuyến, ngày, thời lượng, phương tiện, ngân sách; bỏ chọn mẫu để tạo lịch trình trống.
2. Bản sao có một OWNER là bạn và các điểm dừng mẫu. Chọn **Thêm địa điểm** để lưu vào kho hoặc ngày cụ thể. Trong kho, tìm tên/loại bằng tiếng Việt có dấu hoặc không dấu; chọn **Xếp vào ngày** để chuyển điểm sang timeline.
3. Chọn **Mời bạn**. Bottom sheet tạo mã mời thật, cho phép sao chép liên kết; thông báo đã sao chép tự trở về sau 2 giây. Liên kết có hiệu lực 48 giờ, dùng một lần.
4. Mở liên kết trong trình duyệt khác/cửa sổ riêng tư để thử người B, nhập tên và chọn **Cùng nhau lên đường**. Sau khi tham gia, B được chuyển về lịch trình chung. OWNER không còn nút mời khi đã đủ hai người.
5. Mở lại liên kết đã dùng để xem thông báo lời mời không còn hiệu lực. Cài đặt cho phép đổi chuyến, tạo chuyến mới và đăng xuất.

Cookie HttpOnly xác định người dùng; không lưu token phiên hoặc token mời trong localStorage. Chỉ ID chuyến đã chọn theo user được lưu để mở lại đúng chuyến khi tải trang. Sau khi người kia chỉnh sửa, tải lại trang để nhận dữ liệu mới; chưa có realtime hay đồng bộ ngoại tuyến.

## Sửa, xóa, đổi thứ tự và chuyển ngày (Bước 2.2)

- Mỗi thẻ trên timeline có nút **Lên/Xuống** ở góc phải và **Sửa/Xóa** ở cuối thẻ. Nút Lên của điểm đầu, Xuống của điểm cuối bị vô hiệu hóa. Số thứ tự 01, 02, 03 được tính lại theo vị trí hiển thị.
- **Sửa** mở bottom sheet điền sẵn tên, loại, ngày/kho tạm, giờ đến/rời đi, dự toán, ghi chú và GPS. Giữ loại tùy chỉnh hoặc chưa chọn của dữ liệu hiện có. Để xóa GPS, để trống cả vĩ độ và kinh độ; tọa độ 0 vẫn là giá trị hợp lệ. Các trường chuyển thành một cột dưới 360px để điều khiển giờ không bị cắt.
- Lưu gửi PATCH kèm version và Idempotency-Key; thành công tải lại Trip, đóng sheet và chọn ngày đích (hoặc Kho tạm). Xóa gửi DELETE với `{ version }`, có hộp xác nhận, Hủy và nút đỏ **Xóa địa điểm**. Sau khi xóa, tải lại danh sách đã được backend dồn thứ tự. Chi tiết hợp đồng API nằm ở [API_STOPS.md](API_STOPS.md).
- Lên/Xuống tráo hai điểm ngay trên màn hình rồi gửi toàn bộ `stopIds` của ngày đến API reorder. Trong lúc chờ, khóa các thao tác trên thẻ, chuyển ngày, thêm điểm và cài đặt; hiển thị spinner và trạng thái đang lưu. Response server cập nhật các version trước khi tải lại toàn bộ Trip. Request bị từ chối sẽ khôi phục thứ tự cũ và hiện nút tải dữ liệu mới.
- Cùng thao tác được retry với cùng Idempotency-Key khi chưa biết kết quả; thao tác mới sau lần lưu thành công dùng key mới. Form đang gửi không nhận thêm lần bấm hoặc đóng sheet.
- Lỗi 409 khi sửa/xóa/xếp ngày giữ modal và cho phép **Tải lại dữ liệu mới**. Lưu/xóa bị khóa cho đến khi tải lại; form sửa vẫn giữ bản nháp trước khi người dùng chọn tải. Khi version thay đổi, form được điền lại bằng dữ liệu mới. Nếu điểm đã bị xóa, hiển thị thông báo điểm không còn trong chuyến đi.
- Kho tạm có Sửa/Xóa và giữ nút **Xếp vào ngày**. Các nút sửa/xóa/di chuyển của lịch trình mẫu mở lời nhắc tạo chuyến đi riêng, không gửi request ghi dữ liệu mẫu.

Nghiệm thu với `npm run dev`, Chromium tại 390×844, 320×844 và 1440×900: sửa giờ/ghi chú/dự toán/GPS và F5; Lên/Xuống ba điểm và F5; Hủy/xác nhận xóa, dồn số thứ tự; chuyển ngày → kho → xếp lại; chỉnh sửa/xóa trong kho; lỗi nhập liệu → sửa lỗi; hai tab tạo 409 → tải bản mới; reorder bị từ chối → rollback → tải lại; Escape hoàn trả focus. Trạng thái optimistic/pending được kiểm tra khi giữ khóa tạm riêng chuyến QA, không làm chậm API của các chuyến khác. Đây là kiểm tra trình duyệt theo kích thước, chưa phải kiểm tra trên điện thoại vật lý hoặc đo FPS.

Ảnh và receipt SHA-256 của bước này nằm ở `tmp/stop-interactions-verification/visual-evidence.json`. Dữ liệu QA được tạo riêng; bước duyệt tự động đã chặn việc xóa vĩnh viễn nên chuyến/tài khoản QA được giữ lại để chờ cho phép dọn. Không sửa lịch trình seed. Chạy `npm run typecheck` từ thư mục gốc để kiểm tra toàn monorepo, và `npm run build --workspace frontend` để tạo bản frontend production.

## Cấu trúc và thiết kế

- React Router quản lý `/`, `/onboarding`, `/join/:token`; URL không tồn tại chuyển về trang chủ. Các tab phụ dùng query `?tab=map|expenses|packing` và hỗ trợ Back của trình duyệt.
- `services/api.ts` thêm `/api`, gửi `credentials: 'include'`, đọc lỗi JSON, timeout 15 giây và hỗ trợ AbortSignal. Vite proxy `/api` sang cổng 5000.
- `context/TripContext.tsx` tải phiên/chuyến, chọn mẫu khi phù hợp, tránh response cũ ghi đè response mới, có lỗi và thử lại.
- `components/layout/` chứa khung tối đa 420px, TopBar và BottomNav 76px có safe area. `components/ui/` chứa Button, Feedback và Sheet dùng native dialog để giữ focus, Escape và hoàn trả focus.
- `features/itinerary/` chứa hero, day tabs, timeline, kho/tìm kiếm và form thêm/xếp điểm. `features/trip/` chứa onboarding, lời mời, cài đặt; `features/invite/` chứa preview/join.
- Giữ tokens của bản 00: Source Serif 4, Be Vietnam Pro, nền `#F7F3EC`, thẻ `#FFFEFC`, xanh `#28523B`, tuyến cam đất `#A94D2C`, bo góc 10/16/24px. Đối chiếu bố cục bản 01 và 04. Ảnh vùng cao dùng lại asset `tmp/design-prototype-draft-20261111/assets/ha-giang-road.png`, sao chép vào `public/images/`.
- Các thành phần dùng dữ liệu thật, không tạo GPS giả. Đoạn 46 km/1 giờ 30 của tuyến mẫu có nhãn ước tính tham khảo; chưa gọi dịch vụ định tuyến.

## Phạm vi và kiểm chứng

Bản đồ, Chi tiêu và Hành lý hiện là màn hình chờ. Chưa có service worker/cache ngoại tuyến, kéo thả hoặc realtime. Các thao tác điểm dừng kết nối API Bước 2.1, có kiểm tra quyền ACTIVE, version cho sửa/xóa/chuyển ngày và Idempotency-Key cho tất cả thao tác ghi.

Đã thử trên Chromium với viewport 320×844, 390×844 và 1440×900: lịch trình/kho/tìm kiếm, form trống → sửa → gửi thành công, tạo bản sao, thêm điểm, xếp ngày và tải lại giữ dữ liệu; copy lời mời và reset nhãn; người B tham gia/đổi trang; dùng lại mã bị từ chối; đóng sheet bằng Escape trả focus; API ngắt → thông báo lỗi → thử lại phục hồi. Đây là kiểm tra trình duyệt mô phỏng kích thước, chưa kiểm tra thiết bị iOS/Android thật hoặc đo FPS chuyển động.

Ảnh nghiệm thu và receipt có hash nằm tại `tmp/frontend-verification/visual-evidence.json`. Dữ liệu QA được dọn riêng; dữ liệu seed giữ nguyên. Bộ test HTTP có 30 kiểm tra pass; TypeScript và build của hai workspace đều thành công.

Khi triển khai frontend, cấu hình SPA fallback về `index.html` để mở trực tiếp `/join/:token` và `/onboarding`, đồng thời reverse proxy `/api` sang backend. `vite preview` chỉ xem bản build; cấu hình proxy hiện tại dành cho dev server. Giữ frontend/API cùng origin khi triển khai để cookie hoạt động như môi trường dev.
