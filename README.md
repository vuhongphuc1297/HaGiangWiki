# 🏔️ Travel Companion Web App — Ứng Dụng Lên Lịch Trình, Bản Đồ & Quản Lý Chi Tiêu Du Lịch 2 Người

> **Lấy cảm hứng thiết kế từ phong cách Editorial Map-First (`Hagiang Wiki - Explore the Loop`)**: Kết hợp trải nghiệm khám phá trực quan qua bản đồ với bộ công cụ quản lý lịch trình, thời tiết khí tượng thời gian thực, sổ chi tiêu tại từng điểm dừng và cấn trừ công nợ dành riêng cho 2 người đồng hành.

---

## 1. Tổng Quan Dự Án (Project Overview)

- **Tên dự án**: Travel Companion Web App (Phiên bản mẫu: *Hà Giang · Explore the Loop*)
- **Nền tảng**: Ứng dụng Web (Responsive Web Application dùng trên cả Laptop và Điện thoại)
- **Quy mô người dùng**: Tối ưu hóa cho nhóm **2 người** (*Tôi* và *Bạn đồng hành*) sử dụng chung mà không cần hệ thống đăng nhập phân quyền phức tạp.
- **Chi phí vận hành**: $0 \text{ VNĐ}$ (Sử dụng 100% các dịch vụ Cloud Database, Hosting và API dữ liệu thời gian thực miễn phí).

---

## 2. Vấn Đề & Giải Pháp (Problem Statement & Solution)

### 2.1. Vấn đề thực tế khi đi du lịch tự túc
1. **Thông tin địa điểm bị phân mảnh**: Đọc được các bài review quán ăn, điểm ngắm cảnh, homestay trên mạng xã hội nhưng không có nơi lưu tạm có cấu trúc (giờ mở cửa, giá vé, mã đặt chỗ, ghi chú) để sau đó mới xếp vào lịch trình.
2. **Bản đồ thiếu tính cá nhân hóa**: Các bản đồ số thông thường có quá nhiều chi tiết thừa, trong khi người đi phượt/du lịch thường muốn theo dõi lộ trình trên một sơ đồ vùng hoặc tấm ảnh bản đồ cung đường do chính mình chuẩn bị.
3. **Bị động trước thời tiết và quãng đường đèo núi**: Không nắm được nhiệt độ, sức gió, độ ẩm theo thời gian thực tại từng điểm dừng và thời gian di chuyển thực tế giữa các chặng.
4. **Lệch ngân sách và rối rắm khi chia tiền 2 người**: Dự toán một đằng nhưng thực chi một nẻo; quên ghi các khoản tiền lẻ (xăng xe, vé, ăn sáng) ngay tại điểm dừng; cuối chuyến mất nhiều thời gian tính toán xem ai đã ứng bao nhiêu và ai còn nợ ai.
5. **Chuẩn bị hành lý thiếu sót hoặc trùng lặp**: Không phân biệt rõ đồ dùng chung (ai là người phụ trách mang theo) và đồ dùng cá nhân theo số ngày đi cũng như phương tiện di chuyển.

### 2.2. Giải pháp của sản phẩm
Xây dựng một **All-in-One Travel Web App** giải quyết trọn vẹn 6 nhu cầu trên trong một giao diện duy nhất:
- **Gom địa điểm trước, xếp lịch sau (Idea Pool $\rightarrow$ Timeline)**: Lưu nhanh mọi địa điểm tâm đắc vào Kho lưu trữ tạm (`day = 0`), sau đó đẩy vào từng ngày và đổi thứ tự điểm dừng linh hoạt.
- **Bản đồ lộ trình kép (Wiki Loop Map & Custom Image Map)**: Hiển thị các nhãn đánh số thứ tự (`01`, `02`, `03`...) và vạch nối tuyến đường theo màu sắc từng ngày trực tiếp trên bản đồ phân vùng hoặc trên tấm ảnh bản đồ do người dùng tải lên.
- **Đồng bộ Thời tiết & Đường đi Realtime**: Chỉ lấy dữ liệu từ các nguồn khí tượng và bản đồ uy tín (**Open-Meteo API** và **OSRM / OpenStreetMap**).
- **Ghi chi tiêu ngay tại điểm dừng & Tự động quyết toán 2 người**: Đối chiếu trực tiếp *Dự toán* và *Thực chi* tại mỗi điểm dừng; tự động tính số tiền ròng cần chuyển trả giữa 2 người vào cuối chuyến.
- **Checklist hành lý theo ngữ cảnh**: Tự động gợi ý đồ đạc theo số ngày, phương tiện (*Xe máy / Ô tô / Máy bay*) và tách biệt rõ *Đồ chung* (có người phụ trách) với *Đồ cá nhân*.

---

## 3. Thiết Kế Luồng Giao Diện (UI/UX Architecture)

Ứng dụng được chia thành **2 chế độ trang chính** chuyển đổi nhanh trên thanh điều hướng:

### 3.1. Trang chính: `Explore Hà Giang` (Luồng cuộn dọc 3 tầng)
1. **Tầng 1 — Hero Banner & Trạm Thời Tiết Realtime (Đầu trang)**:
   - Hiển thị khung cảnh đặc trưng của chuyến đi, tổng số ngày, phương tiện di chuyển chính và tổng ngân sách.
   - Thanh quan trắc thời tiết thời gian thực tại 5 khu vực trọng điểm trên toàn tuyến (nhiệt độ $^\circ\text{C}$, sức gió $\text{km/h}$, độ cao và trạng thái thời tiết).
2. **Tầng 2 — Bản Đồ Lộ Trình & Lịch Trình Tổng (Giữa trang - Split-Screen)**:
   - **Cột trái ($35\%$ màn hình)**: Thanh tìm kiếm, bộ lọc theo Ngày / Khu vực (`Zone`) và danh sách thẻ địa điểm rút gọn.
   - **Cột phải ($65\%$ màn hình)**: Bản đồ `The big picture` hiển thị tuyến đường nối theo kế hoạch, các nhãn ghim đánh số, hộp thông tin nhanh (Inspector Card) và cụm nút thao tác nổi (`Toàn tuyến`, `Drop a pin`, `Tải ảnh bản đồ riêng`).
3. **Tầng 3 — Lịch Trình Chi Tiết, Quãng Đường & Sổ Chi Tiêu (Cuối trang)**:
   - Hiển thị chi tiết từng ngày theo khung giờ (`07:00 - 08:45`...), giờ mở cửa, thông tin đặt chỗ, ghi chú kinh nghiệm và quãng đường/thời gian di chuyển tới điểm tiếp theo.
   - Tích hợp nút **`+ Ghi tiền ăn/xăng/vé`** ngay trên từng thẻ điểm dừng và **Bảng Quyết Toán Công Nợ 2 Người** ở cuối trang.

### 3.2. Trang thiết lập: `Create custom tour +` (Studio Lên Kế Hoạch)
- **Phân mục 1 (Gom địa điểm & Xếp thứ tự)**: Biểu mẫu thêm địa điểm mới vào Kho tạm hoặc đưa thẳng vào từng ngày; nút đẩy thứ tự Lên/Xuống giữa các điểm dừng.
- **Phân mục 2 (Checklist Hành lý)**: Quản lý danh sách đồ dùng chung (gắn tên người mang) và đồ cá nhân của 2 người, kèm nút tự động gợi ý đồ theo số ngày và phương tiện.
- **Phân mục 3 (Cấu hình Chuyến đi)**: Chỉnh sửa tên chuyến đi, số ngày, phương tiện và tổng ngân sách dự kiến.

---

## 4. Kiến Trúc Kỹ Thuật & Công Nghệ Đề Xuất (Tech Stack)

### 4.1. Sơ đồ kiến trúc tổng thể
$$\text{React Client (Vite + Tailwind)} \quad \longleftrightarrow \quad \text{Node.js REST API (Express + Prisma)} \quad \longleftrightarrow \quad \text{PostgreSQL (Supabase / Neon)}$$

Song song đó, trình duyệt/server tích hợp trực tiếp 2 nguồn dữ liệu thời gian thực miễn phí:
- **Thời tiết khí tượng**: `https://api.open-meteo.com/v1/forecast`
- **Đường đi & Khoảng cách**: `https://router.project-osrm.org/route/v1/driving`

### 4.2. Chi tiết bộ công nghệ
| Thành phần | Công nghệ lựa chọn | Mục đích sử dụng |
| :--- | :--- | :--- |
| **Frontend** | React 18 (Vite), Tailwind CSS, Lucide Icons | Xây dựng giao diện 3 tầng mượt mà, phản hồi nhanh, hỗ trợ cả máy tính và điện thoại. |
| **Bản đồ ảnh** | SVG Interactive Overlay / Leaflet (`CRS.Simple`) | Phủ lớp nhãn điểm dừng và đường nối lộ trình lên bản đồ phân vùng hoặc ảnh tĩnh của người dùng. |
| **Backend** | Node.js, Express.js | Cung cấp RESTful API xử lý lưu trữ lịch trình, tọa độ ghim, chi tiêu và hành lý. |
| **ORM & Database** | Prisma ORM + PostgreSQL (Supabase/Neon) | Quản lý dữ liệu có cấu trúc, đảm bảo toàn vẹn khóa ngoại giữa Chuyến đi $\rightarrow$ Điểm dừng $\rightarrow$ Chi tiêu. |
| **Triển khai (Deploy)** | Vercel (Frontend) + Render/Railway (Backend) | Đưa sản phẩm lên môi trường Internet miễn phí để cả 2 người cùng truy cập. |

---

## 5. Thiết Kế Cơ Sở Dữ Liệu (Database Schema - Prisma)

Dưới đây là cấu trúc tệp `prisma/schema.prisma` hoàn chỉnh phục vụ trực tiếp cho việc khởi tạo cơ sở dữ liệu PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// 1. Bảng Chuyến đi (Trip)
model Trip {
  id             String        @id @default(uuid())
  name           String
  subtitle       String?
  days           Int           @default(3)
  budget         Int           @default(5000000)
  transport      String        @default("Xe máy") // "Xe máy" | "Ô tô" | "Máy bay"
  customMapUrl   String?       // Đường dẫn ảnh bản đồ do người dùng tải lên
  userA          String        @default("Tôi")
  userB          String        @default("Bạn đồng hành")
  stops          Stop[]
  expenses       Expense[]
  packingItems   PackingItem[]
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
}

// 2. Bảng Điểm dừng & Kho địa điểm (Stop)
model Stop {
  id             String    @id @default(uuid())
  tripId         String
  trip           Trip      @relation(fields: [tripId], references: [id], onDelete: Cascade)
  code           String    // Nhãn đánh số trên bản đồ: "01", "02"...
  name           String
  zone           String    // Khu vực: "Quản Bạ", "Đồng Văn", "Mã Pì Lèng"...
  category       String?
  day            Int       @default(0) // 0 = Lưu ở Kho tạm (chờ xếp lịch), 1..N = Ngày thứ N
  order          Int       @default(1) // Thứ tự điểm dừng trong ngày
  timeSlot       String    @default("08:00 - 09:30")
  openingHours   String?
  estimatedCost  Int       @default(0)
  bookingInfo    String?
  notes          String?
  lat            Float     @default(22.8233) // Vĩ độ GPS thực tế (phục vụ Open-Meteo & OSRM)
  lng            Float     @default(104.9836) // Kinh độ GPS thực tế
  mapX           Float     @default(50) // Tọa độ ngang (%) trên ảnh bản đồ (0 - 100)
  mapY           Float     @default(50) // Tọa độ dọc (%) trên ảnh bản đồ (0 - 100)
  pinned         Boolean   @default(true)
  expenses       Expense[]
  createdAt      DateTime  @default(now())
}

// 3. Bảng Chi tiêu thực tế (Expense)
model Expense {
  id             String    @id @default(uuid())
  tripId         String
  trip           Trip      @relation(fields: [tripId], references: [id], onDelete: Cascade)
  stopId         String?
  stop           Stop?     @relation(fields: [stopId], references: [id], onDelete: SetNull)
  category       String    // "Ăn uống" | "Xăng xe" | "Phòng nghỉ" | "Vé" | "Khác"
  description    String
  amount         Int
  paidBy         String    // "userA" | "userB"
  splitType      String    @default("EQUAL") // "EQUAL" (Chia đôi) | "FOR_OTHER" (Chi hộ 100%) | "PERSONAL" (Cá nhân)
  createdAt      DateTime  @default(now())
}

// 4. Bảng Hành lý (PackingItem)
model PackingItem {
  id             String    @id @default(uuid())
  tripId         String
  trip           Trip      @relation(fields: [tripId], references: [id], onDelete: Cascade)
  name           String
  type           String    @default("SHARED") // "SHARED" (Đồ chung) | "PERSONAL" (Đồ cá nhân)
  category       String?
  assignedTo     String?   // "userA" | "userB" (Dành cho đồ dùng chung)
  checked        Boolean   @default(false)    // Trạng thái cho đồ chung
  checkedA       Boolean   @default(false)    // Trạng thái của Người A cho đồ cá nhân
  checkedB       Boolean   @default(false)    // Trạng thái của Người B cho đồ cá nhân
}
```

---

## 6. Công Thức Nghiệp Vụ & Thuật Toán Cốt Lõi (Core Business Logic)

### 6.1. Công thức ánh xạ tọa độ điểm ghim trên ảnh bản đồ bất kỳ
Để các điểm dừng không bị lệch vị trí khi hiển thị trên màn hình máy tính và điện thoại có kích thước khác nhau, tọa độ điểm ghim $(X, Y)$ khi người dùng bấm chuột lên khung bản đồ có chiều rộng $W$ và chiều cao $H$ được chuẩn hóa về hệ phần trăm $[0, 100]$:

$$X_{\%} = \text{clamp}\left(\frac{x_{\text{click}} - x_{\text{left}}}{W} \times 100, \, 6, \, 94\right), \quad Y_{\%} = \text{clamp}\left(\frac{y_{\text{click}} - y_{\text{top}}}{H} \times 100, \, 8, \, 92\right)$$

### 6.2. Thuật toán cấn trừ công nợ 2 người (2-Person Splitwise)
Gọi $E$ là tập hợp các khoản chi tiêu trong chuyến đi. Với mỗi khoản chi $i \in E$ có số tiền $A_i$:
- Biến số dư nợ ròng $\Delta_{\text{net}}$ (Dương nếu **Người B nợ Người A**, Âm nếu **Người A nợ Người B**) được tính tích lũy như sau:

$$\Delta_{\text{net}} = \sum_{i \in E} \delta_i$$

Trong đó giá trị $\delta_i$ của từng giao dịch được xác định bởi người trả (`paidBy`) và hình thức chia (`splitType`):
- Nếu `paidBy = userA`:
  - `splitType = EQUAL` (Chia đôi 50/50): $\delta_i = +\frac{A_i}{2}$
  - `splitType = FOR_OTHER` (A ứng trả hộ B $100\%$): $\delta_i = +A_i$
  - `splitType = PERSONAL` (A tự chi cho riêng mình): $\delta_i = 0$
- Nếu `paidBy = userB`:
  - `splitType = EQUAL` (Chia đôi 50/50): $\delta_i = -\frac{A_i}{2}$
  - `splitType = FOR_OTHER` (B ứng trả hộ A $100\%$): $\delta_i = -A_i$
  - `splitType = PERSONAL` (B tự chi cho riêng mình): $\delta_i = 0$

Kết thúc chuyến đi:
- Nếu $\Delta_{\text{net}} > 0$: **Người B** chỉ cần chuyển khoản một lần duy nhất số tiền $|\Delta_{\text{net}}|$ cho **Người A**.
- Nếu $\Delta_{\text{net}} < 0$: **Người A** chỉ cần chuyển khoản một lần duy nhất số tiền $|\Delta_{\text{net}}|$ cho **Người B**.

---

## 7. Danh Sách RESTful API Endpoints (Backend Node.js)

| Phương thức | Endpoint | Mô tả chức năng |
| :--- | :--- | :--- |
| `GET` | `/api/trips/:id` | Lấy toàn bộ thông tin chuyến đi kèm danh sách điểm dừng, chi tiêu và hành lý. |
| `PATCH` | `/api/trips/:id` | Cập nhật cấu hình chuyến đi (tên, số ngày, ngân sách, phương tiện, ảnh bản đồ). |
| `POST` | `/api/stops` | Thêm địa điểm mới vào Kho tạm (`day = 0`) hoặc gắn thẳng vào một ngày cụ thể. |
| `PATCH` | `/api/stops/:id` | Cập nhật thông tin địa điểm, đổi ngày, đổi thứ tự (`order`) hoặc cập nhật tọa độ ghim (`mapX`, `mapY`). |
| `PUT` | `/api/stops/reorder` | Cập nhật hàng loạt thứ tự các điểm dừng sau khi kéo thả hoặc bấm nút Lên/Xuống. |
| `DELETE` | `/api/stops/:id` | Xóa một địa điểm khỏi chuyến đi. |
| `POST` | `/api/expenses` | Ghi nhanh một khoản thực chi (ăn, xăng, phòng, vé) gắn với điểm dừng và người trả. |
| `DELETE` | `/api/expenses/:id` | Xóa một khoản chi tiêu đã nhập. |
| `POST` | `/api/packing` | Thêm một vật dụng mới hoặc khởi tạo danh sách gợi ý theo số ngày & phương tiện. |
| `PATCH` | `/api/packing/:id` | Đánh dấu hoàn thành (`checked`, `checkedA`, `checkedB`) hoặc đổi người phụ trách. |

---

## 8. Cấu Trúc Thư Mục Dự Án (Project Structure)

```text
travel-companion-app/
├── client/                         # Frontend (React + Vite + Tailwind CSS)
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── HeaderNav.jsx       # Thanh chuyển đổi Explore / Create custom tour +
│   │   │   ├── HeroWeatherBanner.jsx # Tầng 1: Banner cảnh quan & Thời tiết Open-Meteo
│   │   │   ├── SplitMapSection.jsx # Tầng 2: Sidebar Lịch trình tổng & Bản đồ lộ trình
│   │   │   ├── DetailedTimeline.jsx# Tầng 3: Lịch chi tiết, Ghi chi tiêu & Bảng công nợ
│   │   │   └── CustomTourStudio.jsx# Trang 2: Gom địa điểm, Xếp thứ tự & Checklist hành lý
│   │   ├── services/
│   │   │   ├── api.js              # Gọi REST API tới Backend Node.js
│   │   │   └── realtime.js         # Tích hợp Open-Meteo API & OSRM Routing API
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
├── server/                         # Backend (Node.js + Express + Prisma)
│   ├── prisma/
│   │   ├── schema.prisma           # Khai báo 4 bảng PostgreSQL
│   │   └── seed.js                 # Dữ liệu mẫu Hà Giang Loop 3N2Đ
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── index.js                # Khởi tạo Express Server
│   ├── .env                        # Chứa biến môi trường DATABASE_URL
│   └── package.json
│
└── README.md                       # Tài liệu kế hoạch & hướng dẫn thực thi dự án
```

---

## 9. Quy Trình Thực Thi Từng Bước (Implementation Roadmap)

### Giai đoạn 1: Khởi tạo Cơ sở dữ liệu & Backend (Ngày 1 - 2)
1. Đăng ký một tài khoản miễn phí trên **Supabase** hoặc **Neon.tech**, tạo một project PostgreSQL mới và lấy chuỗi kết nối `DATABASE_URL`.
2. Khởi tạo thư mục `server/`, cài đặt các gói:
   ```bash
   npm init -y
   npm install express cors dotenv @prisma/client
   npm install -D prisma nodemon
   npx prisma init
   ```
3. Dán nội dung mục **5. Thiết Kế Cơ Sở Dữ Liệu** vào tệp `prisma/schema.prisma` và chạy lệnh tạo bảng:
   ```bash
   npx prisma migrate dev --name init_travel_companion
   ```
4. Viết các API CRUD cơ bản trong `server/src/index.js` theo danh sách ở mục 7.

### Giai đoạn 2: Xây dựng Giao diện React 3 Tầng & Studio Lên Lịch (Ngày 3 - 4)
1. Khởi tạo thư mục `client/` bằng Vite:
   ```bash
   npm create vite@latest client -- --template react
   cd client && npm install lucide-react tailwindcss
   ```
2. Đưa mã nguồn giao diện mẫu (`TravelCompanionApp.jsx`) vào `client/src/App.jsx` và tách thành các component con dễ bảo trì.
3. Kiểm tra luồng cuộn mượt giữa 3 tầng trên trang `Explore Hà Giang` và luồng thêm/sửa dữ liệu ở trang `Create custom tour +`.

### Giai đoạn 3: Tích hợp Bản đồ Ảnh & API Thời gian thực (Ngày 5)
1. Tích hợp hàm tải ảnh bản đồ cá nhân (lưu lên Cloudinary miễn phí hoặc lưu dạng URL/Base64 vào trường `customMapUrl` của bảng `Trip`).
2. Tinh chỉnh bộ gọi API thời tiết **Open-Meteo** và bộ tính quãng đường **OSRM** kèm cơ chế lưu đệm (cache) trong `sessionStorage` để tránh gọi lại quá nhiều lần khi chuyển trang.

### Giai đoạn 4: Kết nối Full-Stack & Đồng bộ 2 Người dùng (Ngày 6)
1. Thay thế các hàm cập nhật `useState` cục bộ trên React bằng các lời gọi `fetch` / `axios` tới Backend Node.js.
2. Bổ sung cơ chế tự động làm mới dữ liệu (Polling mỗi $15\text{ giây}$ hoặc nút `Đồng bộ`) để khi một người vừa nhập khoản chi tiêu trên điện thoại của mình thì điện thoại của người kia cũng cập nhật ngay số dư công nợ.

### Giai đoạn 5: Kiểm thử & Đưa sản phẩm lên Internet (Ngày 7)
1. Đẩy mã nguồn lên GitHub.
2. Kết nối thư mục `server` lên **Render.com** (Web Service miễn phí) và thư mục `client` lên **Vercel.com**.
3. Chia sẻ đường dẫn Web App cho bạn đồng hành và lưu ra màn hình chính điện thoại (Add to Home Screen) để sử dụng trực tiếp trong chuyến đi.