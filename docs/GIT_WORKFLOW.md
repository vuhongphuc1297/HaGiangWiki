# QUY TRÌNH QUẢN LÝ MÃ NGUỒN GIT & GITHUB (GIT WORKFLOW)

Tài liệu này là **bộ quy chuẩn bắt buộc** dành cho Lập trình viên và AI Assistant khi thao tác với kho mã nguồn của dự án **HaGiangWiki**. Mọi hành động tạo nhánh, commit, đẩy mã nguồn và mở Pull Request (PR) phải tuân thủ nghiêm ngặt các điều khoản dưới đây.

---

## 1. NGUYÊN TẮC BẤT KHẢ XÂM PHẠM (CORE INVARIANTS)

1. **Tuyệt đối không commit hoặc push trực tiếp lên nhánh `main`**.
2. **Nhánh `dev` là nhánh tích hợp trung tâm**:
   - Mọi nhánh làm việc (`feature/*`, `fix/*`, `docs/*`, `refactor/*`) phải được rẽ nhánh từ `dev`.
   - Mọi Pull Request (PR) làm việc phải trỏ đích đến (`base branch`) là `dev`.
3. **Nhánh `main` chỉ nhận merge từ `dev`**:
   - Chỉ merge `dev` vào `main` khi hoàn thành một mốc phát hành (Release Milestone) hoặc bản nộp cuối cùng.
4. **Không sử dụng commit vô nghĩa**:
   - Nghiêm cấm các commit như: `update`, `fix`, `final`, `done`, `test`, `code moi`. Mọi commit phải theo chuẩn **Conventional Commits**.

---

## 2. QUY CHUẨN ĐẶT TÊN NHÁNH (BRANCH NAMING)

Tất cả tên nhánh phải viết bằng chữ thường (lowercase), từ nối bằng dấu gạch ngang (`kebab-case`), không dấu:

| Tiền tố | Mục đích | Ví dụ |
| :--- | :--- | :--- |
| `feature/<ten-tinh-nang>` | Thêm màn hình, tính năng, API mới | `feature/trip-planner-ui`<br>`feature/auth-anonymous-session` |
| `fix/<ten-loi>` | Sửa lỗi giao diện hoặc logic | `fix/mobile-navbar-overflow`<br>`fix/cookie-samesite-cors` |
| `docs/<ten-tai-lieu>` | Thêm hoặc sửa đổi tài liệu | `docs/screen-inventory`<br>`docs/api-auth-spec` |
| `refactor/<ten-module>` | Tối ưu, dọn dẹp mã không đổi logic | `refactor/prisma-client-singleton` |
| `test/<ten-module>` | Viết thêm hoặc cập nhật bài test | `test/auth-integration-flow` |

---

## 3. QUY CHUẨN THÔNG ĐIỆP COMMIT (CONVENTIONAL COMMITS)

### Cú pháp:
```text
<type>(<scope>): <mô tả ngắn gọn mục đích thay đổi>
```
*(Phần `(<scope>)` là tùy chọn nhưng được khuyến khích để dễ tra cứu).*

### Các `type` được phép sử dụng:
* **`feat`**: Tính năng hoặc giao diện mới.
* **`fix`**: Sửa lỗi mã nguồn hoặc giao diện.
* **`style`**: Chỉnh sửa định dạng, CSS, responsive, layout (không đổi logic).
* **`refactor`**: Tái cấu trúc mã nguồn (không thêm tính năng, không sửa lỗi).
* **`docs`**: Thêm hoặc cập nhật tài liệu (`.md`).
* **`test`**: Bổ sung hoặc cập nhật mã kiểm thử tự động.
* **`chore`**: Cập nhật cấu hình, dependencies, công cụ build.

### Các `scope` thông dụng trong dự án:
* `frontend`: Các thay đổi trong thư mục `frontend/`.
* `backend`: Các thay đổi trong thư mục `backend/`.
* `db`: Các thay đổi liên quan đến schema Prisma, migrations, seeds.
* `auth`: Các thay đổi liên quan đến xác thực và session.
* `deps`: Cập nhật gói thư viện trong `package.json`.

### Ví dụ commit hợp lệ:
* `feat(frontend): create search stops page with filter controls`
* `feat(backend): add endpoint for trip companion invitation`
* `fix(frontend): handle empty search result state gracefully`
* `style(frontend): adjust hero banner grid for mobile viewports`
* `docs: update git workflow specification`

---

## 4. QUY TRÌNH THỰC THI CHUẨN (EXECUTION PROTOCOL)

Khi AI hoặc Lập trình viên bắt đầu thực hiện bất kỳ công việc nào, phải thực thi tuần tự các bước sau:

### Bước 1: Cập nhật nhánh `dev` mới nhất
```bash
git checkout dev
git pull origin dev
```

### Bước 2: Tạo nhánh làm việc mới từ `dev`
```bash
# Ví dụ tạo nhánh tính năng
git checkout -b feature/<ten-tinh-nang>
```

### Bước 3: Phát triển mã nguồn & Tự kiểm thử cục bộ (Pre-commit Verification)
Trước khi tạo commit, bắt buộc chạy các lệnh kiểm tra:
```bash
# 1. Kiểm tra lỗi kiểu dữ liệu
npm run typecheck

# 2. Kiểm tra test tự động (đối với backend/fullstack)
npm run test:auth
npm run test:stops

# 3. Kiểm tra bản build
npm run build
```

### Bước 4: Tạo Commit nguyên tử (Atomic Commit)
Chia nhỏ các thay đổi thành các commit có nghĩa, không gộp tất cả công việc vào một commit duy nhất:
```bash
git add .
git commit -m "<type>(<scope>): <mô tả thay đổi>"
```

### Bước 5: Đẩy nhánh lên Remote
```bash
git push -u origin feature/<ten-tinh-nang>
```

### Bước 6: Mở Pull Request (PR) vào `dev`
1. Truy cập giao diện GitHub Repository.
2. Mở Pull Request với cấu hình:
   - **Base branch**: `dev` *(chú ý: mặc định GitHub có thể để main, phải đổi sang dev)*.
   - **Compare branch**: `feature/<ten-tinh-nang>`.
3. Đặt tiêu đề PR theo chuẩn: `<type>: <mô tả ngắn>` (Ví dụ: `feat: tích hợp API bộ lọc điểm dừng`).
4. Nội dung PR tóm tắt:
   - Các màn hình / tệp đã chỉnh sửa.
   - Trạng thái kiểm thử cục bộ (`typecheck`, `test`, `build` đã pass).

### Bước 7: Merge vào `dev` và dọn dẹp nhánh
1. Thực hiện merge trên GitHub (khuyến nghị dùng **Squash and Merge** để giữ lịch sử nhánh `dev` tinh gọn).
2. Xóa nhánh feature trên GitHub sau khi merge.
3. Ở máy cục bộ, đồng bộ lại nhánh `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git branch -d feature/<ten-tinh-nang>
   ```

---

## 5. QUY TRÌNH XỬ LÝ XUNG ĐỘT (MERGE CONFLICT)

Nếu nhánh của bạn bị lệch so với `dev` khi mở PR:
```bash
# 1. Chuyển về nhánh đang làm việc
git checkout feature/<ten-tinh-nang>

# 2. Hợp nhất thay đổi mới nhất từ dev vào nhánh của mình
git merge dev

# 3. Xử lý các xung đột trong mã nguồn (chọn mã nguồn chính xác)
# 4. Lưu lại và commit
git add .
git commit -m "fix: resolve merge conflicts with dev"

# 5. Đẩy lại lên remote
git push origin feature/<ten-tinh-nang>
```

---

## 6. QUY TRÌNH PHÁT HÀNH / NỘP BÀI (`dev` → `main`)

Chỉ thực hiện khi toàn bộ các tính năng trong giai đoạn đã hoàn tất và kiểm thử ổn định trên nhánh `dev`:

1. Mở Pull Request trên GitHub:
   - **Base branch**: `main`
   - **Compare branch**: `dev`
   - **Tiêu đề**: `release: hoàn thiện phiên bản vX.X.X`
2. Tiến hành Merge PR vào `main`.
3. Đánh dấu Tag phiên bản trên `main`:
   ```bash
   git checkout main
   git pull origin main
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```
