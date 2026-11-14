# Kiểm thử dành cho chủ dự án

Bạn là người trực tiếp dùng app và đánh giá kết quả. Không cần biết code để bắt đầu.

## Cách phối hợp

- Mỗi lần bàn giao tính năng, AI cung cấp: tính năng giúp làm gì, đường dẫn mở, các bước thử, kết quả mong đợi và giới hạn hiện tại.
- AI chịu trách nhiệm kiểm tra kỹ thuật trước khi bàn giao; ghi rõ kiểm tra nào đã chạy và kết quả thực tế.
- Bạn làm theo bài test, đồng thời ghi lại chỗ khó hiểu, bất tiện hoặc khác mong muốn.
- Kết quả kiểm tra kỹ thuật và kết quả bạn tự kiểm thử được ghi riêng. AI không tự đánh dấu rằng bạn đã nghiệm thu.
- Khi bạn báo lỗi, AI tìm nguyên nhân, sửa và đưa lại đúng bước cần thử. Bạn không cần chẩn đoán lỗi trong code.

## App hiện giúp làm gì?

HaGiangWiki giúp hai người chuẩn bị lịch trình đi Hà Giang: tạo chuyến đi, gom địa điểm, xếp địa điểm vào từng ngày và mời người đồng hành cùng chỉnh sửa.

- **Kho tạm:** nơi lưu địa điểm bạn muốn ghé nhưng chưa quyết định ngày đi.
- **Ngày 1, Ngày 2…:** lịch trình đã xếp cho từng ngày.
- Bản đồ, Chi tiêu và Hành lý hiện là màn hình chờ. Các chức năng này chưa nằm trong bài test đầu tiên.
- Sau khi người đồng hành sửa, cần tải lại trang để thấy dữ liệu mới; hiện chưa tự cập nhật giữa hai thiết bị.

## Bài 01 — Từ ý tưởng đến lịch trình

**Mục tiêu:** tự tạo một chuyến đi, lưu một quán ăn để cân nhắc rồi xếp quán vào Ngày 2; kiểm tra tải lại trang vẫn còn thông tin.

**Thời gian dự kiến:** 5–10 phút.

**Trạng thái nghiệm thu của bạn:** Chưa kiểm thử.

**Nơi thử:** [Mở app trên máy này](http://localhost:5173). Đường dẫn này dùng trên máy đang chạy dự án.

**Chuẩn bị:** dùng một chuyến riêng mang tên `TEST - Chuyến đi của tôi` theo bước 1. Mọi thao tác của bài này thực hiện trong chuyến đó.

| Bước | Bạn làm | Kết quả mong đợi |
| --- | --- | --- |
| 1 | Mở [trang tạo chuyến trống](http://localhost:5173/onboarding?template=0). Nhập tên của bạn nếu được hỏi. Đặt tên chuyến `TEST - Chuyến đi của tôi`, giữ 3 ngày; ô **Dùng lịch trình Hà Giang mẫu** để bỏ chọn. Bấm **Tạo chuyến đi**. | Về màn hình Lịch trình, thấy đúng tên chuyến và các tab Kho tạm, Ngày 1, Ngày 2, Ngày 3. Chuyến chưa có địa điểm. |
| 2 | Chọn **Kho tạm** → **Thêm địa điểm**. Nhập tên `Quán ăn TEST`, chọn loại **Ăn uống**, kiểm tra **Xếp lịch** là **Kho tạm**, dự toán `200000`, ghi chú `Ghé ăn trưa`. Để trống giờ và cả hai ô GPS. Bấm **Lưu địa điểm**. | Form đóng; Kho tạm có đúng một thẻ Quán ăn TEST với ghi chú Ghé ăn trưa và nhãn Chưa có GPS. |
| 3 | Tải lại trang bằng F5 hoặc nút tải lại của trình duyệt, rồi chọn lại **Kho tạm**. | Quán ăn TEST vẫn còn đúng một thẻ, giữ nguyên ghi chú. Việc màn hình trở về Ngày 1 sau khi tải lại không tính là lỗi của bài này. |
| 4 | Trên thẻ Quán ăn TEST, bấm **Xếp vào ngày**, chọn **Ngày 2**, bấm **Xếp vào Ngày 2**. Sau đó kiểm tra cả Kho tạm và Ngày 2. | Quán xuất hiện đúng một lần trong Ngày 2 và không còn trong Kho tạm. Ghi chú vẫn còn. |
| 5 | Tại Ngày 2, bấm **Sửa** trên thẻ. Kiểm tra dự toán vẫn là `200000`. Đổi ghi chú thành `Ghé ăn trưa lúc 12h`, bấm **Lưu thay đổi**. Tải lại trang rồi chọn lại **Ngày 2**. | Quán vẫn ở Ngày 2, đúng một thẻ; ghi chú mới được giữ lại. Mở Sửa kiểm tra thì dự toán vẫn là `200000`. |

Nếu một bước không thực hiện được, báo ngay số bước và điều bạn thấy. Không cần cố hoàn thành những bước phụ thuộc phía sau.

## Gửi kết quả ngay trong chat

Không cần sửa tài liệu hay dùng Git. Bạn có thể trả lời:

```text
Bài 01
1: OK
2: OK
3: Lỗi — tải lại rồi vào Kho tạm thì không thấy Quán ăn TEST.
4–5: Chưa thử vì vướng bước 3.
Chỗ khó hiểu: Tôi chưa nhận ra nút chuyển sang Kho tạm.
```

Bạn cũng có thể gửi ảnh hoặc mô tả tự nhiên. Báo rõ mình đã bấm gì và thấy gì là đủ. Cả lỗi chức năng lẫn chỗ khó dùng đều là phản hồi cần ghi nhận.

## Các bài tiếp theo

Chỉ nhận bài kế tiếp khi đã xử lý kết quả bài đang làm:

1. Nhập thiếu thông tin, hủy thao tác và sửa dữ liệu sai.
2. Thêm nhiều địa điểm, đổi thứ tự, chuyển ngày và xóa địa điểm.
3. Mời người đồng hành, cùng chỉnh sửa và mở lại lời mời đã dùng.

Mỗi bài sẽ được hướng dẫn riêng theo phiên bản app lúc bàn giao.
