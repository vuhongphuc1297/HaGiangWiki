# HaGiangWiki — Giao diện bước 1.4

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

## Cấu trúc và thiết kế

- React Router quản lý `/`, `/onboarding`, `/join/:token`; URL không tồn tại chuyển về trang chủ. Các tab phụ dùng query `?tab=map|expenses|packing` và hỗ trợ Back của trình duyệt.
- `services/api.ts` thêm `/api`, gửi `credentials: 'include'`, đọc lỗi JSON, timeout 15 giây và hỗ trợ AbortSignal. Vite proxy `/api` sang cổng 5000.
- `context/TripContext.tsx` tải phiên/chuyến, chọn mẫu khi phù hợp, tránh response cũ ghi đè response mới, có lỗi và thử lại.
- `components/layout/` chứa khung tối đa 420px, TopBar và BottomNav 76px có safe area. `components/ui/` chứa Button, Feedback và Sheet dùng native dialog để giữ focus, Escape và hoàn trả focus.
- `features/itinerary/` chứa hero, day tabs, timeline, kho/tìm kiếm và form thêm/xếp điểm. `features/trip/` chứa onboarding, lời mời, cài đặt; `features/invite/` chứa preview/join.
- Giữ tokens của bản 00: Source Serif 4, Be Vietnam Pro, nền `#F7F3EC`, thẻ `#FFFEFC`, xanh `#28523B`, tuyến cam đất `#A94D2C`, bo góc 10/16/24px. Đối chiếu bố cục bản 01 và 04. Ảnh vùng cao dùng lại asset `tmp/design-prototype-draft-20261111/assets/ha-giang-road.png`, sao chép vào `public/images/`.
- Các thành phần dùng dữ liệu thật, không tạo GPS giả. Đoạn 46 km/1 giờ 30 của tuyến mẫu có nhãn ước tính tham khảo; chưa gọi dịch vụ định tuyến.

## Phạm vi và kiểm chứng

Bản đồ, Chi tiêu và Hành lý hiện là màn hình chờ đúng phạm vi bước này. Chưa có service worker/cache ngoại tuyến, API sửa/xóa toàn bộ nội dung điểm dừng, drag-and-drop hoặc realtime. Các thao tác thêm/xếp ngày có kiểm tra quyền ACTIVE, version và Idempotency-Key.

Đã thử trên Chromium với viewport 320×844, 390×844 và 1440×900: lịch trình/kho/tìm kiếm, form trống → sửa → gửi thành công, tạo bản sao, thêm điểm, xếp ngày và tải lại giữ dữ liệu; copy lời mời và reset nhãn; người B tham gia/đổi trang; dùng lại mã bị từ chối; đóng sheet bằng Escape trả focus; API ngắt → thông báo lỗi → thử lại phục hồi. Đây là kiểm tra trình duyệt mô phỏng kích thước, chưa kiểm tra thiết bị iOS/Android thật hoặc đo FPS chuyển động.

Ảnh nghiệm thu và receipt có hash nằm tại `tmp/frontend-verification/visual-evidence.json`. Dữ liệu QA được dọn riêng; dữ liệu seed giữ nguyên. Bộ test HTTP có 30 kiểm tra pass; TypeScript và build của hai workspace đều thành công.

Khi triển khai frontend, cấu hình SPA fallback về `index.html` để mở trực tiếp `/join/:token` và `/onboarding`, đồng thời reverse proxy `/api` sang backend. `vite preview` chỉ xem bản build; cấu hình proxy hiện tại dành cho dev server. Giữ frontend/API cùng origin khi triển khai để cookie hoạt động như môi trường dev.
