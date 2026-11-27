# HaGiangWiki — Giao diện mobile đến bước 3.3 / M2

Tab **Chi tiêu** (`/?tab=expenses`) đã hoàn thành Bước 3.2: ngân sách, quyết toán hai người, thêm/sửa/xóa khoản chi, chuyển trả và ghi nhanh tại từng điểm dừng. Hướng dẫn, hành vi đồng bộ và nghiệm thu tại [FRONTEND_EXPENSES.md](FRONTEND_EXPENSES.md).

Tab **Hành lý** (`/?tab=packing`) hoàn thành Bước 3.3: balo riêng tư theo người đăng nhập, checkbox lạc quan, tiến độ, thêm/đổi tên/xóa và nạp bảy gợi ý Hà Giang chống trùng. Không có danh sách chung hoặc quyền xem hộ của OWNER. Hợp đồng tại [API_PACKING.md](API_PACKING.md), đồng bộ/phục hồi và nghiệm thu 108 kiểm thử M2 tại [FRONTEND_PACKING.md](FRONTEND_PACKING.md).

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

Cookie HttpOnly xác định người dùng; không lưu token phiên hoặc token mời trong localStorage. Chỉ ID chuyến đã chọn theo user được lưu để mở lại đúng chuyến khi tải trang. Sau khi người kia chỉnh sửa, bấm **Làm mới dữ liệu** trên TopBar; ứng dụng cũng làm mới ngầm khi quay lại sau ít nhất 30 giây. Chưa có websocket, polling hay đồng bộ ngoại tuyến.

## Sửa, xóa, đổi thứ tự và chuyển ngày (Bước 2.2)

- Mỗi thẻ trên timeline có nút **Lên/Xuống** ở góc phải và **Sửa/Xóa** ở cuối thẻ. Nút Lên của điểm đầu, Xuống của điểm cuối bị vô hiệu hóa. Số thứ tự 01, 02, 03 được tính lại theo vị trí hiển thị.
- **Sửa** mở bottom sheet điền sẵn tên, loại, ngày/kho tạm, giờ đến/rời đi, dự toán, ghi chú và GPS. Giữ loại tùy chỉnh hoặc chưa chọn của dữ liệu hiện có. Để xóa GPS, để trống cả vĩ độ và kinh độ; tọa độ 0 vẫn là giá trị hợp lệ. Các trường chuyển thành một cột dưới 360px để điều khiển giờ không bị cắt.
- Lưu gửi PATCH kèm version và Idempotency-Key; thành công tải lại Trip, đóng sheet và chọn ngày đích (hoặc Kho tạm). Xóa gửi DELETE với `{ version }`, có hộp xác nhận, Hủy và nút đỏ **Xóa địa điểm**. Sau khi xóa, tải lại danh sách đã được backend dồn thứ tự. Chi tiết hợp đồng API nằm ở [API_STOPS.md](API_STOPS.md).
- Lên/Xuống tráo hai điểm ngay trên màn hình rồi gửi toàn bộ `stopIds` của ngày đến API reorder. Trong lúc chờ, khóa các thao tác trên thẻ, chuyển ngày, thêm điểm và cài đặt; hiển thị spinner và trạng thái đang lưu. Response server cập nhật các version trước khi tải lại toàn bộ Trip. Request bị từ chối sẽ khôi phục thứ tự cũ và hiện nút tải dữ liệu mới.
- Cùng thao tác được retry với cùng Idempotency-Key khi chưa biết kết quả; thao tác mới sau lần lưu thành công dùng key mới. Form đang gửi không nhận thêm lần bấm hoặc đóng sheet.
- Lỗi 409 khi sửa/xóa/xếp ngày giữ modal và cho phép **Làm mới dữ liệu**. Lưu/xóa bị khóa cho đến khi tải lại; form sửa vẫn giữ bản nháp trước khi người dùng chọn tải. Nút làm mới đóng form và tải dữ liệu hiện tại; mở lại để sửa tiếp. Nếu đồng bộ ngầm thay đổi version hoặc điểm đã bị xóa, bản nháp vẫn giữ snapshot lúc mở để backend kiểm tra xung đột khi gửi.
- Kho tạm có Sửa/Xóa và giữ nút **Xếp vào ngày**. Các nút sửa/xóa/di chuyển của lịch trình mẫu mở lời nhắc tạo chuyến đi riêng, không gửi request ghi dữ liệu mẫu.

Nghiệm thu với `npm run dev`, Chromium tại 390×844, 320×844 và 1440×900: sửa giờ/ghi chú/dự toán/GPS và F5; Lên/Xuống ba điểm và F5; Hủy/xác nhận xóa, dồn số thứ tự; chuyển ngày → kho → xếp lại; chỉnh sửa/xóa trong kho; lỗi nhập liệu → sửa lỗi; hai tab tạo 409 → tải bản mới; reorder bị từ chối → rollback → tải lại; Escape hoàn trả focus. Trạng thái optimistic/pending được kiểm tra khi giữ khóa tạm riêng chuyến QA, không làm chậm API của các chuyến khác. Đây là kiểm tra trình duyệt theo kích thước, chưa phải kiểm tra trên điện thoại vật lý hoặc đo FPS.

Ảnh và receipt SHA-256 của bước này nằm ở `tmp/stop-interactions-verification/visual-evidence.json`. Dữ liệu QA được tạo riêng; bước duyệt tự động đã chặn việc xóa vĩnh viễn nên chuyến/tài khoản QA được giữ lại để chờ cho phép dọn. Không sửa lịch trình seed. Chạy `npm run typecheck` từ thư mục gốc để kiểm tra toàn monorepo, và `npm run build --workspace frontend` để tạo bản frontend production.

## Cấu hình chuyến đi và đồng bộ hai người (Bước 2.3)

- Trong **Cài đặt chuyến đi**, chỉ thành viên `ACTIVE` có vai trò `OWNER` thấy **Chỉnh sửa cấu hình**. MEMBER xem tên, ngày, số ngày, phương tiện và ngân sách ở chế độ chỉ đọc. Backend tiếp tục kiểm tra quyền cho PATCH.
- Bottom sheet điền sẵn tên (1–200 ký tự), ngày bắt đầu, số ngày (1–30), phương tiện và ngân sách nguyên đồng không âm. Lỗi nhập liệu nằm cạnh trường và focus trường đầu tiên chưa hợp lệ. Ngân sách có dòng định dạng VND dễ đọc.
- Giảm số ngày hiển thị cảnh báo vàng ngay, nêu ngày bị cắt và số địa điểm theo snapshot đang sửa. PATCH gửi `version` của snapshot và UUIDv4 `Idempotency-Key`; retry cùng nội dung dùng lại key. Backend chuyển các điểm về cuối Kho tạm trong transaction. Response cập nhật TripContext và danh sách chuyến ngay; ngày đang xem được giới hạn lại. Notice hiển thị `movedStopsCount` thực tế và nút **Xem Kho lưu tạm** khi có điểm chuyển.
- Form chuyến và các form điểm dừng dùng chung cảnh báo **Dữ liệu vừa được cập nhật trên thiết bị khác**. Bản nháp và version lúc mở không bị thay thế bởi đồng bộ ngầm. Khi nhận 409, giữ bản nháp, khóa gửi tiếp và chờ người dùng bấm **Làm mới dữ liệu** để đóng form, tải dữ liệu mới nhất.
- TopBar có nút làm mới với spinner và trạng thái Đang đồng bộ/Đã lưu/Chưa đồng bộ. Sau khoảng rời ứng dụng ít nhất 30 giây, `visibilitychange`/`focus` kích hoạt cùng luồng refresh ngầm; hai sự kiện của cùng lần quay lại chỉ được tiêu thụ một lần. Các request nền cho cùng chuyến đang chạy được gộp; response cũ không ghi đè response mới hoặc PATCH đã thành công.
- Refresh nền giữ dữ liệu đã tải khi mạng/server lỗi và hiện thông báo thử lại. Lỗi truy cập 401/403/404 loại bỏ dữ liệu chuyến không còn được phép xem. Đây là snapshot trong bộ nhớ khi trang còn mở, chưa phải cache ngoại tuyến bền vững.

Đã nghiệm thu hai phiên cookie độc lập (`localhost:5173` cho OWNER và `127.0.0.1:5174` cho MEMBER): đổi cả năm trường cấu hình, giảm 3 → 2 chuyển đúng 2 điểm và hiện notice; MEMBER chỉ đọc và làm mới thấy dữ liệu mới; 409 ở cả form chuyến và điểm dừng giữ nháp → làm mới phục hồi; OWNER thêm điểm vào kho, MEMBER xếp ngày, OWNER đổi thứ tự, hai bên F5 vẫn cùng danh sách. Khi API tạm ngắt, refresh giữ lịch đang xem; kết nối lại và bấm làm mới phục hồi. Đối chiếu PostgreSQL xác nhận 10 điểm còn nguyên, thứ tự ngày 1 liên tục và seed không đổi.

Đã kiểm tra bố cục 320×844, 390×844 và 1440×900 theo hệ thiết kế hiện có. Ảnh, log kiểm thử, đối chiếu DB và receipt SHA-256 nằm tại `tmp/trip-settings-sync-verification/visual-evidence.json` (artifact cục bộ, không commit); giữ lại dữ liệu QA riêng. Chưa kiểm thử điện thoại vật lý hoặc đo FPS. Cơ chế quay lại ứng dụng được kiểm tra bằng 9 unit test với đồng hồ và sự kiện mô phỏng, chưa nghiệm thu vòng đời Zalo/Maps trên iOS/Android thật.

Từ thư mục gốc, chạy `npm run typecheck`, `npm run build`, `npm run test:auth` (30 kiểm tra), `npm run test:stops` (25 kiểm tra), `npm run test:sync` (9 kiểm tra). Bộ sync không cần DB; hai bộ HTTP cần PostgreSQL theo [DATABASE.md](DATABASE.md). Khi build trên Windows, dừng API dev trước để Prisma có thể sinh lại client.

## Thành viên từ TopBar (Bước 2.4)

- Cụm avatar là một nút mở **Thành viên chuyến đi**, có tên truy cập nêu số lượng X/2 và vùng bấm tối thiểu 44px. Nút xuất hiện cả dưới 375px; dấu cộng viền đứt gợi ý mời khi mới có một người. Chạm avatar hoặc dấu cộng đều mở cùng sheet. Trong lúc tải hoặc lưu thứ tự, nút được khóa cùng các điều khiển còn lại.
- Sheet dùng danh sách thành viên `ACTIVE` hiện tại từ TripContext, hiển thị tên (ưu tiên displayName, dự phòng nickname), avatar và màu theo vai trò, huy hiệu **Trưởng nhóm / Người tạo**, **Bạn đồng hành / Người tham gia**, cùng nhãn **(Bạn)** theo userId. Tên chuyến và tên thành viên dài được xuống dòng.
- Khi mới có một người, hiển thị ô chờ viền đứt. Chỉ OWNER có nút **Mời người đồng hành**; nút chuyển sang InviteModal hiện có để tạo liên kết 48 giờ và sao chép. MEMBER không có nút mời. Khi đủ hai người, hiển thị thông báo đủ thành viên và nút **Về lịch trình**. Lịch trình mẫu chỉ xem, không tạo lời mời.
- Khi người thứ hai tham gia, OWNER dùng nút làm mới hoặc luồng đồng bộ khi quay lại của Bước 2.3 để nhận đủ hai avatar. Sheet đang mở cũng đọc dữ liệu mới từ context. Chi tiêu cũng dùng cùng luồng làm mới; chưa có đồng bộ thời gian thực.

Đã thử trên Chromium 390×844, 320×844 và 1440×900: từ TopBar mở sheet một người → mời → sao chép → tham gia bằng phiên cookie độc lập → OWNER làm mới thấy hai avatar; cả hai xem đúng vai trò và nhãn Bạn; F5 giữ danh sách; lịch trình mẫu không có nút mời; Enter mở và Escape đóng, trả focus về nút thành viên. Ở 320px, đo vùng bấm 58×44px, sheet rộng đúng 320px và không tràn ngang. Không ghi nhận lỗi console trên hai phiên QA. Đây là mô phỏng trình duyệt, chưa thử chạm trên điện thoại vật lý hoặc đo FPS.

Typecheck/build toàn dự án và 64 kiểm tra hồi quy (auth 30, stops 25, sync 9) đều pass. Ảnh, log và receipt SHA-256 cục bộ: `tmp/members-verification/visual-evidence.json`. Chuyến QA tạo riêng cho luồng mời, dùng lại hai tài khoản QA của M1, giữ dữ liệu để đối chiếu; không thay đổi seed, API hoặc schema cho Bước 2.4.

## Cấu trúc và thiết kế

- React Router quản lý `/`, `/trip`, `/demo`, `/onboarding`, `/join/:token`; URL không tồn tại chuyển về trang chủ. Các tab phụ dùng query `?tab=map|expenses|packing` và hỗ trợ Back của trình duyệt.
- **Trang chủ giới thiệu (Landing Page - Bước 4.3):** Khi người dùng chưa có chuyến đi hoạt động hoặc là khách vãng lai, `/` hiển thị `LandingPage` với 3 lối vào rõ ràng: Tạo chuyến đi mới (`/onboarding`), Nhập mã/link mời 6 ký tự, và Khám phá lịch trình mẫu (`/demo`). Nếu đã có chuyến đi trong máy, trang chủ có thẻ dẫn nhanh vào `/trip`.
- **Xóa chuyến đi (Bước 4.3):** Trong `SettingsModal`, OWNER có nút nguy hiểm màu đỏ "Xóa chuyến đi này", mở hộp thoại xác nhận trước khi gọi `DELETE /api/trips/:tripId` để xóa vĩnh viễn và điều hướng về chuyến tiếp theo hoặc `/`.
- `services/api.ts` thêm `/api`, gửi `credentials: 'include'`, đọc lỗi JSON, timeout 15 giây và hỗ trợ AbortSignal. Vite proxy `/api` sang cổng 5000.
- `context/TripContext.tsx` tải phiên/chuyến, chọn mẫu khi phù hợp, cập nhật từ PATCH, gộp refresh nền và tránh response cũ ghi đè dữ liệu mới. `returnSync.ts` quản lý sự kiện quay lại ứng dụng và có unit test độc lập.
- `components/layout/` chứa khung tối đa 420px, TopBar và BottomNav 76px có safe area. `components/ui/` chứa Button, Feedback và Sheet dùng native dialog để giữ focus, Escape và hoàn trả focus.
- `features/itinerary/` chứa hero, day tabs, timeline, kho/tìm kiếm và form thêm/xếp điểm. `features/trip/` chứa onboarding, lời mời, cài đặt; `features/invite/` chứa preview/join.
- `features/expenses/` chứa trang ngân sách/công nợ, các modal và context sổ chi tiêu. Dữ liệu tiền từ API được giữ dưới dạng chuỗi, hiển thị/tính phần chia bằng BigInt.
- `features/packing/` chứa checklist riêng tư, context theo user/trip/member và store kiểm soát cập nhật lạc quan, rollback, version, idempotency và response cũ.
- Giữ tokens của bản 00: Source Serif 4, Be Vietnam Pro, nền `#F7F3EC`, thẻ `#FFFEFC`, xanh `#28523B`, tuyến cam đất `#A94D2C`, bo góc 10/16/24px. Đối chiếu bố cục bản 01 và 04. Ảnh vùng cao dùng lại asset `tmp/design-prototype-draft-20261111/assets/ha-giang-road.png`, sao chép vào `public/images/`.
- Các thành phần dùng dữ liệu thật, không tạo GPS giả. Đoạn 46 km/1 giờ 30 của tuyến mẫu có nhãn ước tính tham khảo; chưa gọi dịch vụ định tuyến.

## Phạm vi và kiểm chứng

Bản đồ hiện là màn hình chờ. Hành lý đã kết nối API riêng tư Bước 3.3; xem [FRONTEND_PACKING.md](FRONTEND_PACKING.md). Chi tiêu kết nối API Bước 3.1; xem [FRONTEND_EXPENSES.md](FRONTEND_EXPENSES.md). Chưa có service worker/cache ngoại tuyến, kéo thả hoặc realtime. Các thao tác điểm dừng kết nối API Bước 2.1, có kiểm tra quyền ACTIVE, version cho sửa/xóa/chuyển ngày và Idempotency-Key cho tất cả thao tác ghi.

Đã thử trên Chromium với viewport 320×844, 390×844 và 1440×900: lịch trình/kho/tìm kiếm, form trống → sửa → gửi thành công, tạo bản sao, thêm điểm, xếp ngày và tải lại giữ dữ liệu; copy lời mời và reset nhãn; người B tham gia/đổi trang; dùng lại mã bị từ chối; đóng sheet bằng Escape trả focus; API ngắt → thông báo lỗi → thử lại phục hồi. Đây là kiểm tra trình duyệt mô phỏng kích thước, chưa kiểm tra thiết bị iOS/Android thật hoặc đo FPS chuyển động.

Ảnh nghiệm thu và receipt có hash nằm tại `tmp/frontend-verification/visual-evidence.json`. Dữ liệu QA được dọn riêng; dữ liệu seed giữ nguyên. Bộ test HTTP có 30 kiểm tra pass; TypeScript và build của hai workspace đều thành công.

Khi triển khai frontend, cấu hình SPA fallback về `index.html` để mở trực tiếp `/join/:token` và `/onboarding`, đồng thời reverse proxy `/api` sang backend. `vite preview` chỉ xem bản build; cấu hình proxy hiện tại dành cho dev server. Giữ frontend/API cùng origin khi triển khai để cookie hoạt động như môi trường dev.
