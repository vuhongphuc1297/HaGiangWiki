# HaGiangWiki

Monorepo npm workspaces: Express + TypeScript ở `backend/`, React + TypeScript + Vite + Tailwind CSS ở `frontend/`.

## Chạy cục bộ

Yêu cầu Node.js **22.12 trở lên** (khuyến nghị Node.js 24 LTS), npm 10 trở lên.

```sh
npm run install:all
npm run db:migrate --workspace backend
npm run db:seed --workspace backend
npm run dev
```

- Frontend: http://localhost:5173
- API health: http://localhost:5000/api/health
- Health qua Vite proxy: http://localhost:5173/api/health

`install:all` dùng npm workspaces để cài dependencies cho cả root, backend và frontend trong một lần, với một `package-lock.json` chung. `concurrently` chạy hai dev server và dừng tiến trình còn lại khi một tiến trình thoát. Nhấn Ctrl+C để dừng cả hai.

`backend/.env` mẫu đã được tạo và được bỏ qua bởi Git. Khi lấy mã nguồn trên máy khác, sao chép `backend/.env.example` thành `backend/.env`:

```dotenv
PORT=5000
CLIENT_URL=http://localhost:5173
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hagiangwiki?schema=public"
```

Backend validate cấu hình bằng Zod trước khi chạy; `DATABASE_URL` là URL bắt buộc. Chuẩn bị PostgreSQL và `backend/.env` trước các lệnh migration/seed. `CLIENT_URL` là origin CORS được cho phép, có hỗ trợ credentials. Nếu đổi cổng API, cập nhật cả proxy trong `frontend/vite.config.ts`. Frontend giữ cổng 5173 bằng `strictPort` để tránh lệch cấu hình CORS.

Xem [hướng dẫn cơ sở dữ liệu](docs/DATABASE.md) để tạo database, dùng Prisma Studio, kiểm tra dữ liệu và các ràng buộc.

## Các lệnh khác

```sh
npm run typecheck
npm run test:auth
npm run test:stops
npm run build
npm run dev --workspace backend
npm run dev --workspace frontend
npm run start --workspace backend
npm run preview --workspace frontend
```

`start` của backend yêu cầu build trước. `preview` chỉ xem thử frontend đã build; proxy `/api` được cấu hình cho dev server. Khi triển khai, cấu hình reverse proxy `/api` tới backend.

Backend đã có API đăng ký ẩn danh, cookie session, tạo/xem chuyến đi và mã mời bạn đồng hành dùng một lần. Xem [hướng dẫn API xác thực](docs/API_AUTH.md). `test:auth` chạy HTTP end-to-end trên cổng ngẫu nhiên với PostgreSQL thật và tự dọn dữ liệu thử; không cần mở dev server trước.

Backend cũng hỗ trợ sửa/xóa mềm điểm dừng, sắp xếp an toàn và cập nhật cấu hình chuyến đi. Khi giảm số ngày, điểm dừng vượt thời lượng mới được chuyển về kho tạm, giữ nguyên thông tin. Xem [API điểm dừng và cấu hình chuyến đi](docs/API_STOPS.md). `test:stops` kiểm tra các luồng này với PostgreSQL thật, gồm version conflict, quyền truy cập, ghi đồng thời, idempotency và rollback; tự dọn dữ liệu thử.

Frontend đã nối các luồng lịch trình, kho địa điểm, tạo chuyến đi và nhận lời mời. Xem [hướng dẫn giao diện](docs/FRONTEND.md) để thử trọn luồng hai người. Trang chủ tự hiển thị lịch trình mẫu; chọn **Dùng lịch trình này** để tạo bản riêng, thêm/xếp địa điểm và mời bạn đồng hành.

`typecheck` chỉ kiểm tra TypeScript. Sau khi thay đổi Prisma schema, chạy `npm run db:generate --workspace backend` trước. Trên Windows, dừng dev server bằng Ctrl+C trước khi generate/build để tránh khóa DLL Prisma.

## Cấu trúc

```text
backend/
  prisma/schema.prisma
  prisma/migrations/
  prisma/seed.ts
  prisma/verify.ts
  src/config/env.ts
  src/config/database.ts
  src/app.ts
  src/server.ts
  .env.example
  package.json
  tsconfig.json
frontend/
  public/manifest.webmanifest
  public/icons/
  src/components/layout/MobileContainer.tsx
  src/components/layout/TopBar.tsx
  src/components/layout/BottomNav.tsx
  src/components/ui/
  src/context/TripContext.tsx
  src/services/
  src/features/itinerary/
  src/features/trip/
  src/features/invite/
  public/images/ha-giang-road.png
  src/lib/utils.ts
  src/App.tsx
  src/index.css
  src/main.tsx
  index.html
  tailwind.config.js
  postcss.config.js
  vite.config.ts
package.json
package-lock.json
```

## Thiết kế và phạm vi hiện tại

- Tokens lấy từ `design/00-he-thong-thiet-ke.png`: nền `#F7F3EC`, bề mặt `#FFFEFC`, xanh rừng `#28523B`; bo góc nút/thẻ/sheet là 10/16/24px.
- Google Fonts: Source Serif 4 (600/700/800) cho tiêu đề; Be Vietnam Pro (400/500/600/700) cho nội dung. Cần mạng để tải font; đã có font dự phòng.
- Dùng Tailwind CSS **3.4** để hỗ trợ trực tiếp `tailwind.config.js` và PostCSS theo [hướng dẫn Vite của Tailwind 3](https://v3.tailwindcss.com/docs/guides/vite).
- Khung di động tối đa 420px, hỗ trợ safe areas, chiều cao viewport động, nút cao ít nhất 48px và focus bàn phím. Giữ pinch zoom; input 16px và `touch-action: manipulation` giúp hạn chế zoom ngoài ý muốn.
- Lịch trình và kho địa điểm đọc API thật; có trạng thái tải, lỗi, timeout và thử lại. Thêm địa điểm, xếp vào ngày, tạo chuyến đi, sao chép lời mời và tham gia đều ghi dữ liệu thật. Bản đồ, Chi tiêu và Hành lý hiện là màn hình chờ.
- Chuyến seed công khai chỉ để xem. Bản sao riêng chỉ sao chép điểm dừng, có một OWNER mới; không sao chép thành viên, khoản chi, công nợ hoặc phiên của mẫu.
- Có manifest, PNG icons, Apple touch icon và meta standalone để chuẩn bị PWA. Chưa đăng ký service worker/cache ngoại tuyến.
- Đã có Prisma 6.19.3 + PostgreSQL với 10 model, migration, singleton client và seed Hà Giang chạy lại được. Health check hiện vẫn kiểm tra HTTP API; không dùng endpoint này làm kiểm tra kết nối database.

## Tài liệu và Quy trình

- [Quy trình Git & GitHub chuẩn](docs/GIT_WORKFLOW.md) — Hướng dẫn phân nhánh, commit, kiểm thử và mở PR cho lập trình viên và AI Assistant.
- [Hướng dẫn cơ sở dữ liệu](docs/DATABASE.md)
- [Hướng dẫn API xác thực](docs/API_AUTH.md)
- [API điểm dừng và cấu hình chuyến đi](docs/API_STOPS.md)
- [Hướng dẫn giao diện người dùng](docs/FRONTEND.md)

Tài liệu nghiệp vụ và các bản thiết kế hiện có được giữ trong `docs/` và `design/`.
