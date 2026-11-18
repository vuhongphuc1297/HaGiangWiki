# Hướng dẫn làm việc trong HaGiangWiki

Đọc [quy trình Git của dự án](docs/GIT_WORKFLOW.md) trước khi bắt đầu một bước phát triển.

## Quy tắc bàn giao do chủ dự án yêu cầu

- Với mỗi bước phát triển mới, chuẩn bị nhánh `feature/<ten-buoc>` từ `dev` đã cập nhật trước khi sửa mã. Nếu đang tiếp tục cùng một bước trên nhánh feature phù hợp, dùng tiếp nhánh đó.
- Sau khi hoàn thành bước và các kiểm tra phù hợp đã đạt, tự thực hiện **commit và push lên origin**. Đây là yêu cầu thường trực; không chờ người dùng nhắc Git hoặc xác nhận lại cho từng lần commit/push.
- Chia commit theo phần việc có nghĩa, dùng Conventional Commits và mô tả rõ thay đổi. Tách backend, frontend, kiểm thử hoặc tài liệu khi hợp lý; tránh commit chung chung như `update`, `done`, `final`.
- Chỉ stage các file thuộc công việc đang thực hiện; giữ riêng thay đổi có sẵn của người dùng và các file ngoài phạm vi.
- Khi bàn giao, báo tên nhánh, các commit mới và kết quả push. Nếu có phụ thuộc vào commit chưa có trên `dev`, nêu rõ phụ thuộc đó.
- **PR và merge do người dùng xử lý.** Không tự tạo PR (kể cả PR nháp), merge vào `dev`/`main`, xóa nhánh hoặc tạo bản phát hành, trừ khi người dùng yêu cầu riêng thao tác đó.

Quy tắc này áp dụng cho các bước tiếp theo trong repo. Chỉ dẫn mới hơn của người dùng được ưu tiên.
