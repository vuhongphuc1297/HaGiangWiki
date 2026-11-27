# HaGiangWiki — Quy trình thực hiện dự án

> Kế hoạch xây dựng ứng dụng lập lịch trình, bản đồ và quản lý chi tiêu du lịch dành cho hai người.

- **Ngày cập nhật:** 27/11/2026.
- **Thư mục dự án:** `D:\Dev\HaGiangWiki`.
- **Trạng thái:** đã hoàn thiện Tuần 1–4 và Bước 4.3 (mở rộng danh mục hành trang cá nhân, Landing Page `/`, mã mời 6 ký tự, xóa vĩnh viễn chuyến đi, tách biệt định danh 2 user) và triển khai bản thử nghiệm lên Cloudflare Pages (`pages.dev`) + Render + Neon; đạt **136/136 kiểm thử tự động** (`typecheck` và `build` frontend đạt), sẵn sàng bước vào Tuần 5 (Ngoại tuyến và đồng bộ an toàn) và nghiệm thu trên hai điện thoại thật.
- **Khung thời gian tham khảo:** 6 tuần cho 1 lập trình viên làm toàn thời gian.
- **Cách sử dụng:** thực hiện theo thứ tự phụ thuộc; chỉ đánh dấu hoàn thành khi đạt tiêu chí nghiệm thu, không chỉ khi đã viết xong giao diện.

## 1. Mục tiêu của bản MVP

Hai người có thể cùng chuẩn bị và sử dụng một chuyến đi qua luồng:

**Tạo chuyến đi → Gom địa điểm → Xếp lịch → Xem bản đồ → Ghi chi tiêu → Quyết toán.**

### Trong phạm vi

- Tạo và cấu hình chuyến đi; cấp và thu hồi quyền truy cập cho người đồng hành.
- Kho địa điểm chưa xếp lịch, lịch trình theo ngày và thứ tự điểm dừng.
- Giao diện ưu tiên điện thoại, có chuyển đổi giữa bản đồ và danh sách.
- Một kiểu bản đồ địa lý, thời tiết cơ bản và ước tính quãng đường/thời gian di chuyển.
- Thêm, sửa, xóa khoản chi; ba kiểu chia tiền; số dư công nợ và ghi nhận chuyển trả.
- Checklist hành lý cá nhân riêng tư cho từng người (điều chỉnh phạm vi tại Tuần 3: bỏ đồ chung, mỗi người quản lý balo độc lập).
- Xem lịch trình đã tải khi mất mạng; thêm khoản chi vào hàng đợi để đồng bộ khi có mạng.
- Trạng thái lưu dữ liệu rõ ràng; xuất hoặc sao lưu dữ liệu chuyến đi.

### Sau MVP

- Bản đồ ảnh tùy chỉnh và cơ chế hiệu chỉnh tọa độ trên ảnh.
- Tự động gợi ý hành lý theo số ngày và phương tiện.
- Trình bày thời tiết nâng cao cho nhiều khu vực.
- Hiệu ứng, hình ảnh và bố cục Editorial hoàn chỉnh.
- Nhóm nhiều hơn hai người, nhiều loại tiền và các tỷ lệ chia tiền khác.

## 2. Nguyên tắc thực hiện

1. Hoàn thiện từng luồng từ giao diện đến cơ sở dữ liệu, tránh để phần lưu trữ đến cuối dự án.
2. Có môi trường triển khai thử từ tuần 1 và kiểm tra trên hai điện thoại từ tuần 2.
3. Thiết kế quyền truy cập, version dữ liệu và chống gửi trùng ngay từ nền móng.
4. Kiểm thử logic tiền và các thao tác có thể gây mất dữ liệu trong từng giai đoạn.
5. Khi mất mạng hoặc dịch vụ bên ngoài lỗi, việc xem lịch đã lưu và ghi chi tiêu vẫn có phương án xử lý.
6. Chi phí 0 đồng là mục tiêu trong giới hạn sử dụng; kiểm tra điều kiện dịch vụ trước khi chọn nhà cung cấp.
7. Lịch 6 tuần là ước tính, không phải cam kết thời hạn; điều chỉnh theo kết quả nghiệm thu và thời gian thực tế.

## 3. Các quyết định cần chốt trong tuần 1

| Nội dung | Kết quả cần xác định |
| --- | --- |
| Truy cập chuyến đi | Cách mời người đồng hành, xác thực yêu cầu sửa dữ liệu và thu hồi quyền. Không dùng riêng ID chuyến đi làm bằng chứng cấp quyền. |
| Ngày và giờ | Ngày khởi hành, múi giờ chuyến đi và cách lưu giờ đến/rời địa điểm. |
| Ngân sách | Tính cho cả hai hay từng người; có bao gồm khoản cá nhân không; có cộng dự toán địa điểm trong kho tạm không. |
| Tiền lẻ | Đơn vị tiền, cách chia số lẻ và làm tròn; dùng cùng quy tắc ở backend, giao diện và kiểm thử. |
| Chuyển trả | Ghi nhận thanh toán công nợ riêng với chi tiêu, cách sửa/hủy và cách tính số còn nợ. |
| Thay đổi số ngày | Cách xử lý điểm dừng thuộc những ngày bị bỏ, tránh làm mất dữ liệu âm thầm. |
| Địa điểm thiếu GPS | Cho phép lưu địa điểm chưa có tọa độ; không gọi định tuyến/thời tiết bằng tọa độ giả định. |
| Ngoại tuyến | MVP hỗ trợ đọc lịch đã tải và thêm khoản chi; sửa lịch trình cần kết nối mạng. |
| Dịch vụ và phiên bản | Chốt phiên bản công nghệ, nhà cung cấp, giới hạn miễn phí và cấu hình triển khai. |

## 4. Roadmap tổng thể

```mermaid
flowchart TD
    A["Tuần 1 · Nền móng<br/>Phạm vi, dữ liệu, quyền truy cập"]
    B["Tuần 2 · Lập kế hoạch<br/>Kho địa điểm và lịch trình"]
    C["Tuần 3 · Quản lý tiền<br/>Chi tiêu, công nợ và hành lý"]
    D["Tuần 4 · Khám phá<br/>Bản đồ và thời tiết"]
    E["Tuần 5 · Sử dụng khi di chuyển<br/>Ngoại tuyến và đồng bộ"]
    F["Tuần 6 · Hoàn thiện<br/>Kiểm thử thực tế và phát hành"]
    G["Mục tiêu · MVP sử dụng được<br/>cho chuyến đi của hai người"]
    H["Sau MVP<br/>Bản đồ ảnh, gợi ý hành lý<br/>và hoàn thiện giao diện"]

    A --> B
    B -->|"M1 · Hai thiết bị cùng lập lịch"| C
    C -->|"M2 · Công nợ tính chính xác"| D
    D --> E
    E --> F
    F -->|"M3 · Vượt qua kiểm thử chuyến đi"| G
    G -.-> H
```

## 5. Công việc và nghiệm thu từng giai đoạn

### Tuần 1 — Chốt phạm vi và dựng nền móng

**Công việc**

- [ ] Chốt các quyết định nghiệp vụ tại mục 3 và phác thảo các màn hình điện thoại chính.
- [ ] Chốt phiên bản công nghệ; định hướng ban đầu là React + Vite + Tailwind, Node.js + Express, Prisma + PostgreSQL.
- [ ] Tạo cấu trúc frontend/backend, cấu hình môi trường mẫu và hướng dẫn chạy cục bộ.
- [ ] Hoàn thiện các mô hình Trip, Stop, Expense, PackingItem; thiết kế thêm dữ liệu quyền truy cập và thanh toán công nợ.
- [ ] Bổ sung ngày khởi hành, quy tắc validation, chỉ mục và ràng buộc quan hệ cần thiết.
- [ ] Bảo đảm khoản chi và điểm dừng được liên kết thuộc cùng một chuyến đi.
- [ ] Thiết kế ID do client tạo, khóa chống gửi trùng và kiểm tra version cho thao tác ghi.
- [ ] Xây dựng luồng tạo/mở chuyến đi, mời người đồng hành và thu hồi quyền.
- [ ] Triển khai môi trường thử với dữ liệu mẫu Hà Giang.

**Nghiệm thu:** mở được bản triển khai thử trên điện thoại; tạo và tải lại được chuyến đi; yêu cầu sửa từ người không có quyền bị từ chối. Không đưa thông tin bí mật vào mã nguồn hoặc tài liệu công khai.

### Tuần 2 — Kho địa điểm và lịch trình dùng chung

**Công việc**

- [x] Thêm, sửa, xóa địa điểm; lưu kho tạm với `day = 0`.
- [x] Chuyển địa điểm vào ngày, chuyển giữa các ngày và đổi thứ tự trong ngày.
- [x] Cập nhật thứ tự theo transaction; đánh số nhãn hiển thị liên tục từ 01.
- [x] Hiển thị lịch trình, giờ, ghi chú (gồm thông tin đặt chỗ) và dự toán tại điểm dừng.
- [x] Cập nhật cấu hình chuyến đi và xử lý giảm số ngày theo quy tắc đã chốt.
- [x] Bổ sung trạng thái tải, dữ liệu trống, lỗi lưu và dữ liệu đã thay đổi trên thiết bị khác.
- [x] Làm mới dữ liệu thủ công/ngầm khi quay lại; phát hiện cập nhật dựa trên version cũ, đã kiểm tra bằng hai phiên trình duyệt độc lập.
- [x] Bổ sung Bước 2.4: nút thành viên trên TopBar, danh sách ACTIVE có vai trò/nhãn Bạn, ô chờ và lối vào luồng mời 48 giờ; nghiệm thu một người → hai người qua hai phiên độc lập.

**Mốc M1:** hai thiết bị cùng thêm/sửa/xếp điểm dừng; tải lại vẫn đúng dữ liệu; thay đổi thứ tự không làm mất hoặc trùng điểm; quyền truy cập được áp dụng cho mọi thao tác.

**Kết quả Bước 2.3:** OWNER sửa cấu hình và giảm 3 → 2 ngày, hai điểm Ngày 3 chuyển vào Kho tạm; MEMBER chỉ xem cấu hình, làm mới thấy thay đổi. Hai tài khoản cùng thêm/xếp/đổi thứ tự rồi F5 giữ đúng dữ liệu; xung đột 409 ở chuyến/điểm dừng giữ bản nháp và có nút làm mới. Đạt typecheck/build và 64 kiểm tra tự động (30 auth, 25 stops, 9 sync). Chi tiết, ảnh và giới hạn nghiệm thu tại [FRONTEND.md](FRONTEND.md#cấu-hình-chuyến-đi-và-đồng-bộ-hai-người-bước-23). Chưa coi mô phỏng là nghiệm thu thực địa trên hai điện thoại.

### Tuần 3 — Chi tiêu, công nợ và checklist

**Công việc**

- [x] Thêm, sửa, xóa chi tiêu, có thể gắn với điểm dừng hoặc chỉ gắn với chuyến đi (gồm nút ghi nhanh từ thẻ điểm dừng trên Lịch trình).
- [x] Hỗ trợ người trả A/B và ba kiểu `EQUAL`, `FOR_OTHER`, `PERSONAL`.
- [x] Hiển thị dự toán, thực chi và chênh lệch theo quy tắc ngân sách đã thống nhất (cảnh báo >80% vàng, >100% đỏ).
- [x] Tính công nợ bằng `BigInt`, xử lý tiền lẻ chính xác từng đồng và trạng thái không còn nợ.
- [x] Ghi nhận chuyển trả bằng dữ liệu thanh toán riêng (`SettlementTransfer`); tính số dư còn lại và không cộng vào tổng chi.
- [x] Áp dụng chống gửi trùng (`Idempotency-Key`) và kiểm tra version (`409`) ngay từ API ghi chi tiêu, chuyển trả và hành trang.
- [x] Làm checklist hành trang cá nhân riêng tư cho từng người (điều chỉnh phạm vi theo yêu cầu chủ dự án: bỏ phần đồ chung; lọc cứng theo chủ sở hữu ở backend để A/B không thấy hoặc tác động đồ của nhau, kèm gợi ý 7 món phượt Hà Giang).
- [x] Kiểm thử phép tính công nợ, sửa/xóa giao dịch, thao tác gửi lại yêu cầu và tính riêng tư hành trang.

**Mốc M2:** các tình huống chia tiền cho kết quả đúng; sửa/xóa cập nhật đúng số dư; chuyển trả giảm đúng số còn nợ; gửi lại cùng giao dịch không tạo bản sao.

**Ví dụ đối chiếu:** A trả 600.000đ chia đôi, B trả 200.000đ chia đôi, A trả hộ B 100.000đ ⇒ B nợ A 300.000đ. Nếu B đã chuyển trả A 100.000đ thì số còn nợ là 200.000đ. Khoản cá nhân không làm thay đổi công nợ giữa hai người.

**Kết quả Tuần 3 (Bước 3.1–3.3):** hoàn thiện sổ chi tiêu, quyết toán công nợ hai người và hành trang cá nhân riêng tư mà không sửa đổi schema/migration. Đối chiếu hai phiên cookie độc lập đạt đúng kịch bản chuẩn 300k → 200k → 300k → 200k, ghi nhanh từ điểm dừng, xung đột 409, và xác nhận A/B không thấy hay sửa được hành trang của nhau. Đạt `typecheck`, `build` frontend và 108/108 kiểm thử tự động (auth 30, stops 25, sync 9, expenses 17, expense-ui 3, packing 15, packing-ui 9). Chi tiết tại [API_EXPENSES.md](API_EXPENSES.md), [FRONTEND_EXPENSES.md](FRONTEND_EXPENSES.md), [API_PACKING.md](API_PACKING.md) và [FRONTEND_PACKING.md](FRONTEND_PACKING.md). Chưa coi mô phỏng trình duyệt là nghiệm thu thực địa trên hai điện thoại vật lý.

### Tuần 4 — Bản đồ địa lý và thời tiết cơ bản

**Công việc**

- [x] Làm một bản đồ địa lý với ghim điểm dừng, lọc theo ngày và chọn điểm trên danh sách/bản đồ.
- [x] Tạo chuyển đổi Bản đồ/Danh sách phù hợp điện thoại.
- [x] Nhập hoặc chọn GPS thực; hiển thị rõ địa điểm chưa có tọa độ.
- [x] Tích hợp ước tính quãng đường/thời gian giữa các điểm, theo cấu hình phương tiện phù hợp.
- [x] Tích hợp thời tiết hiện tại hoặc dự báo ngày đến khi nguồn dữ liệu hỗ trợ.
- [x] Hiển thị nguồn, thời điểm dữ liệu và trạng thái không có dự báo cho ngày được chọn.
- [x] Thêm cache có thời hạn, timeout, giới hạn gọi lại và phương án khi API lỗi.

**Nghiệm thu:** ghim khớp địa điểm; không dùng tọa độ giả cho điểm còn thiếu GPS; phân biệt dữ liệu thời tiết hiện tại với dự báo; lỗi dịch vụ ngoài không chặn lập lịch và ghi tiền.

### Bước 4.3 — Cửa ngõ ứng dụng, mã mời ngắn gọn và vòng đời chuyến đi

> Bước hoàn thiện trải nghiệm thực tế sau khi triển khai thử nghiệm trên `pages.dev`. Giải quyết triệt để sự nhập nhằng về luồng User mới, cơ chế tham gia 2 người và quản trị chuyến đi trước khi bước vào Tuần 5.

**Công việc**

- [x] **Trang chủ giới thiệu (Landing Page) tại `/`:**
  - Thay vì tự động mở cứng lịch trình mẫu (`demo_trip_hagiang_20261120`), người dùng chưa có chuyến hoặc khách vãng lai sẽ được chào đón tại Trang chủ giới thiệu phong cách Editorial/Minimalist.
  - Giới thiệu định vị sản phẩm: Sổ tay hành trình Hà Giang dành riêng cho 2 người.
  - 3 lối vào rõ ràng (Call-To-Action):
    1. **Tạo chuyến đi mới:** Dẫn vào form khởi tạo chuyến đi riêng (Tên bạn, Tên chuyến, Ngày đi, Ngân sách).
    2. **Tham gia chuyến đi:** Ô nhập mã mời (hỗ trợ mã 6 ký tự hoặc dán toàn bộ link mời).
    3. **Khám phá lịch trình mẫu (3N2Đ):** Mở xem tham khảo bản demo tại `/demo` với banner hướng dẫn rõ ràng.
  - Nếu đã có chuyến đi trong máy, trang chủ có thẻ "Tiếp tục chuyến đi: …" dẫn vào `/trip` giúp vào nhanh mà không bị lạc hướng.
- [x] **Hệ thống mã mời 6 ký tự (Invite Code) kết hợp liên kết một chạm:**
  - Bổ sung cơ chế sinh mã mời 6 ký tự chữ hoa & số (`generateInviteCode(6)`, loại trừ các ký tự dễ nhầm lẫn như `0/O`, `1/I/L`), vẫn tương thích ngược token hex 64 ký tự cũ.
  - Đường link chia sẻ rút gọn: `<CLIENT_URL>/join/<inviteCode>` (triển khai trên `https://hagiangwiki.pages.dev/join/<inviteCode>`).
  - Hỗ trợ cả 2 cách tham gia: Bấm link trực tiếp (tự động điền mã) hoặc nhập mã code thủ công trên ô ở Trang chủ.
  - Kiểm tra tính hợp lệ, thời hạn 48 giờ và giới hạn tối đa 2 người đồng hành.
- [x] **Chức năng Xóa chuyến đi (Delete Trip Lifecycle):**
  - Backend: Endpoint `DELETE /api/trips/:tripId` yêu cầu xác thực và chỉ cho phép `OWNER` đang `ACTIVE`.
  - Thực hiện xóa cascade toàn bộ điểm dừng, chi tiêu, chuyển trả, hành lý và mã mời của chuyến đi. Tuyệt đối chặn xóa chuyến mẫu (`protectDemoFromDeletion`).
  - Frontend: Thêm nút **Xóa chuyến đi này** màu đỏ trong Cài đặt chuyến đi (`SettingsModal`), kèm hộp thoại xác nhận cảnh báo mất dữ liệu.
  - Sau khi xóa: Tự động chuyển sang chuyến đi tiếp theo (nếu có nhiều chuyến) hoặc quay về Trang chủ giới thiệu.
- [x] **Tách biệt và tường minh hóa định danh 2 User:**
  - Giao diện thể hiện rõ danh tính hiện tại của phiên làm việc (`SettingsModal`, `OnboardingPage`, `JoinTripPage`).
  - Khách vãng lai và người dùng thứ 2 khi tự truy cập độc lập không bị dính vào trạng thái hay chuyến đi của người dùng thứ 1 (tách khóa `localStorage` theo `userId`, tách `/demo` với `DemoTripProvider`).

**Nghiệm thu:** Đã hoàn thành mã nguồn và hợp nhất PR #6–#9 vào `dev`, kiểm tra tự động đạt 136/136 test; còn nghiệm thu thao tác hai người thực địa trên hai điện thoại thật.

### Tuần 5 — Ngoại tuyến và đồng bộ an toàn

**Công việc**

- [ ] Lưu lịch trình đã tải để đọc khi mất mạng, kèm thời điểm cập nhật gần nhất.
- [ ] Lưu bền vững khoản chi chờ gửi để không mất khi tải lại hoặc đóng/mở ứng dụng.
- [ ] Đồng bộ hàng đợi khi có mạng, sử dụng cùng ID/khóa chống trùng khi gửi lại.
- [ ] Hiển thị rõ Đang lưu, Đã lưu và Chưa đồng bộ.
- [ ] Xử lý trường hợp server đã lưu nhưng client chưa nhận được phản hồi.
- [ ] Xử lý xung đột version và trường hợp quyền truy cập bị thu hồi trong lúc ngoại tuyến.
- [ ] Kiểm thử mất mạng, kết nối chập chờn, tải lại và thao tác đồng thời trên hai thiết bị.

**Nghiệm thu:** mất mạng vẫn đọc được lịch đã tải và thêm khoản chi chờ gửi; mở lại ứng dụng không mất hàng đợi; có mạng lại thì mỗi khoản được ghi đúng một lần. Không báo Đã lưu khi server chưa xác nhận và không ghi đè xung đột âm thầm.

### Tuần 6 — Kiểm thử thực tế và phát hành MVP

**Công việc**

- [ ] Chạy trọn luồng chuyến đi giả lập theo danh sách tại mục 7 trên hai điện thoại.
- [ ] Kiểm tra giao diện trên điện thoại/máy tính, thao tác chạm, thông báo lỗi và thời gian tải.
- [ ] Kiểm tra lại quyền truy cập, dữ liệu giữa các chuyến và tính chính xác của công nợ.
- [ ] Bổ sung xuất/sao lưu dữ liệu và thử quy trình khôi phục hoặc nhập lại phù hợp định dạng đã chọn.
- [ ] Hoàn thiện README chạy dự án, cấu hình môi trường mẫu và hướng dẫn sử dụng.
- [ ] Kiểm tra giới hạn và hành vi của các dịch vụ đã chọn trước khi phát hành.
- [ ] Triển khai bản phát hành, kiểm tra sau triển khai và ghi lại cách quay về phiên bản trước.

**Mốc M3:** hoàn thành chuyến đi giả lập từ tạo lịch đến quyết toán, bao gồm mất mạng và lỗi dịch vụ ngoài. Không còn lỗi nghiêm trọng về truy cập trái phép, mất dữ liệu, ghi trùng hoặc tính sai tiền.

## 6. Quy trình cho mỗi hạng mục

1. **Xác định kết quả:** ghi hành vi mong muốn, dữ liệu đầu vào, trường hợp lỗi và tiêu chí nghiệm thu.
2. **Kiểm tra phụ thuộc:** xác định thay đổi schema, API, quyền truy cập và ảnh hưởng đến dữ liệu cũ.
3. **Triển khai:** hoàn thiện từ lưu trữ/API đến giao diện và trạng thái lưu dữ liệu.
4. **Xác minh:** kiểm tra luồng chính và trường hợp biên; tự động hóa các kiểm thử nghiệp vụ hoặc rủi ro dữ liệu quan trọng.
5. **Thử trên môi trường triển khai:** kiểm tra bằng dữ liệu mẫu; dùng hai thiết bị khi có chức năng dùng chung.
6. **Ghi nhận:** cập nhật tiến độ, lỗi còn tồn tại và quyết định thay đổi phạm vi.

Một hạng mục chỉ hoàn thành khi dữ liệu được lưu đúng, quyền truy cập được kiểm tra, lỗi liên quan được xử lý và tiêu chí nghiệm thu đã đạt. Việc đánh dấu hoàn thành phải dựa trên kết quả kiểm tra thực tế.

## 7. Kịch bản nghiệm thu xuyên suốt

- [x] A tạo chuyến đi 3 ngày, cấp quyền cho B; B mở được trong phiên cookie độc lập (mô phỏng thiết bị khác).
- [x] A thêm địa điểm vào kho tạm, B xếp vào ngày 1; cả hai tải lại vẫn thấy đúng lịch.
- [x] Hai người cập nhật cùng một dữ liệu; ứng dụng phát hiện và xử lý xung đột theo quy tắc đã chốt.
- [x] Đổi thứ tự điểm dừng và giảm số ngày không làm mất dữ liệu âm thầm.
- [x] Thêm khoản chi với đủ ba kiểu chia, sửa/xóa khoản chi và kiểm tra số dư.
- [x] Kiểm tra tình huống tiền lẻ, số dư bằng 0 và ghi nhận chuyển trả một phần/toàn bộ.
- [x] Kiểm tra khoản chi không thể gắn điểm dừng thuộc chuyến khác.
- [ ] Ngắt mạng, đọc lịch đã tải, thêm khoản chi rồi đóng/mở lại ứng dụng.
- [ ] Kết nối lại và gửi lại yêu cầu; mỗi khoản chi chỉ xuất hiện một lần.
- [ ] Dịch vụ thời tiết/định tuyến lỗi; người dùng vẫn lập lịch và ghi tiền được.
- [ ] Thu hồi quyền của B; các yêu cầu ghi tiếp theo từ B bị từ chối.
- [ ] Xuất/sao lưu dữ liệu và xác minh dữ liệu có thể đọc, khôi phục hoặc nhập lại theo thiết kế.

## 8. Theo dõi tiến độ và điều chỉnh phạm vi

| Hạng mục | Trạng thái hiện tại | Bằng chứng để cập nhật |
| --- | --- | --- |
| Thư mục dự án | Đã tạo | Có thư mục `HaGiangWiki`. |
| Tài liệu tổng quan dự án | Đã tạo | Có tệp `readme.md`. |
| Tài liệu quy trình | Đã tạo | Có tệp `QUY_TRINH_DU_AN.md`. |
| Tuần 1 | Đã có nền móng cục bộ; còn nghiệm thu triển khai | Prisma/PostgreSQL, session, lời mời, quyền và kiểm thử HTTP; hướng dẫn tại DATABASE.md, FRONTEND.md. |
| Tuần 2 / M1 | Đạt mô phỏng hai phiên; chờ hai điện thoại thật | Bước 2.1–2.4; CRUD/xếp lịch, co ngày không mất dữ liệu, OWNER/MEMBER, 409, refresh, danh sách thành viên và mời từ TopBar; 64 test pass và ảnh nghiệm thu cục bộ. |
| Tuần 3 / M2 | Đạt mô phỏng hai phiên; chờ hai điện thoại thật | Bước 3.1–3.3; Expense/Settlement BigInt, 3 kiểu chia, chuyển trả, hành trang cá nhân riêng tư (bỏ đồ chung theo quyết định chủ dự án); 108 test pass và ảnh nghiệm thu cục bộ. |
| Tuần 4 | Đã hoàn thành bản đồ & thời tiết | Tuyến đường OSRM, bản đồ Leaflet, Open-Meteo, proxy Cloudflare Functions; 12 test `external-flow` đạt. |
| Bước 4.3 | Đã hoàn thành mã nguồn & deploy thử (PR #6–#9) | Danh mục hành trang cá nhân, Landing Page `/`, mã mời 6 ký tự, xóa chuyến đi, tách định danh 2 user; 136/136 test đạt (auth 35, stops 25, sync 9, expenses 17, expense-ui 3, packing 17, packing-ui 15, external 12, landing 3). |
| Tuần 5 | Chưa bắt đầu | Kết quả thử ngoại tuyến, gửi lại và xung đột. |
| Tuần 6 / M3 | Chưa bắt đầu | Kết quả nghiệm thu trọn luồng và bản phát hành. |

Khi chậm tiến độ, giảm mức hoàn thiện hình thức, lùi tính năng nâng cao và có thể lùi checklist nếu phần chi tiêu cần thêm thời gian. Giữ ưu tiên cho quyền truy cập, lưu dữ liệu, công nợ chính xác và sử dụng được trên hai điện thoại. Sau mỗi tuần, cập nhật trạng thái, bằng chứng nghiệm thu và thời gian dự kiến còn lại vào tài liệu này.
