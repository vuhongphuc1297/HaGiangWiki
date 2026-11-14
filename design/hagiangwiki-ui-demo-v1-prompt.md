# HaGiangWiki — Prompt ảnh demo giao diện v1

- Công cụ: built-in `image_gen`.
- Ảnh: `hagiangwiki-ui-demo-v1.png`.
- Nguồn: `README.md`, `docs/CAU_TRUC_HE_THONG.md`, `docs/QUY_TRINH_DU_AN.md`.
- Phạm vi: một ảnh concept gồm ba màn hình di động (Lịch trình, Bản đồ, Chi tiêu); chưa phải app hoạt động. Ngày, thời tiết, địa điểm và số tiền hiển thị là dữ liệu minh họa. Bản đồ là sơ đồ minh họa.

## Prompt đã sử dụng

```text
Use case: ui-mockup
Asset type: ONE high-fidelity interface concept image for the HaGiangWiki mobile-first travel companion web app. A refined editorial product design board showing THREE consistent mobile screen mockups, aligned side by side, straight-on, on a warm off-white presentation canvas. Wide landscape composition, crisp high resolution, roomy margins, all screens fully visible. No laptop, no tilted perspective, no hands, no extra devices or decoration. Screen rectangles with subtle rounded edges and tiny shadows, no bulky hardware. Main content is the actual app interface, not marketing copy.

Source intent: The app helps TWO travel partners plan a 3-day Ha Giang motorcycle loop, collect unscheduled places, view a geographic route map, log expenses, split money, and pack bags. Mobile-first usable controls and fixed four-tab bottom navigation. Original reference style is editorial map-first 'Hà Giang · Explore the Loop'. These are illustrative fictional trip data, not a live service screenshot.

Visual direction: premium travel field guide meets a practical mobile planning app. Warm paper background, dark charcoal text, muted deep forest-green actions, restrained terracotta route markers, fine pale borders. Strong typographic hierarchy, beautiful Vietnamese-capable editorial serif for the trip title and contemporary highly legible sans serif UI labels. Consistent 8px grid, 20px padding, realistic 44px touch targets, restrained corner radii. A compact authentic photographic crop of Ha Giang limestone mountains and a winding road on the itinerary screen. The other screens emphasize functionality and generous whitespace. Do not use glassmorphism or neon gradients. Use thin coherent line icons.

Outside the screens at top left, small wordmark "HaGiangWiki", title "Hà Giang, cùng nhau lên đường.", small descriptor "Ý tưởng giao diện · Mobile-first". Beneath each screen a small caption respectively "01 / LỊCH TRÌNH", "02 / BẢN ĐỒ", "03 / CHI TIÊU". At bottom edge, one discreet note "Bản demo · Dữ liệu minh họa".

SCREEN 1, itinerary, exact copy and hierarchy:
Compact header wordmark "HaGiangWiki", two tiny avatar initials T and L, green status badge "Đã lưu".
Small scenic mountain photo banner, bold editorial title "Hà Giang", subtitle "Explore the Loop".
Trip meta line "3 ngày · Xe máy · 2 người".
Compact pill "20–22.11.2026".
Four day-selection pills in one row "Kho tạm" "Ngày 1" "Ngày 2" "Ngày 3"; Ngày 1 selected dark green.
Section "Lịch trình hôm nay".
A clean vertical timeline with two or three readable stop cards:
"01" "07:00 – 08:00" "TP. Hà Giang" secondary "Ăn sáng & nhận xe", small "+ Ghi chi tiêu".
Connector with motorcycle icon and small text "46 km · 1 giờ 30".
"02" "09:30 – 10:30" "Cổng trời Quản Bạ" secondary "Ngắm cảnh · Dự toán 60.000đ".
Third compact card if room "03" "Yên Minh".
Fixed bottom navigation with icons and exact labels "Lịch trình" "Bản đồ" "Chi tiêu" "Hành lý"; Lịch trình highlighted. All bottom nav labels fit on one line.

SCREEN 2, geographic map:
Header back chevron and "Bản đồ chuyến đi", small green status indicator.
Main heading "Cả cung đường, trong tầm tay." not too large.
Day filter pills "Toàn tuyến" "Ngày 1" "Ngày 2" "Ngày 3", Toàn tuyến selected.
A large elegant illustrative light geographic map occupies most of screen: muted terrain contour relief, sparse subtle roads, thin river, northern Vietnam mountainous region. A winding forest-green route with terracotta numbered stop markers, relevant labels "Hà Giang", "Quản Bạ", "Yên Minh", "Đồng Văn", "Mã Pí Lèng", "Mèo Vạc"; approximate schematic geography, do not pretend surveyed accuracy. Small legend "Sơ đồ minh họa". Route is a visually coherent loop; markers sit on route. Discreet map zoom and recenter controls.
Bottom floating selected-stop card, readable:
"05 · Mã Pí Lèng"
"Ngắm cảnh · Ngày 2"
Small weather chip sun-cloud icon "18°C" and text "Dữ liệu mẫu".
Button "Xem điểm dừng".
Same four-tab bottom navigation, Bản đồ selected.

SCREEN 3, expenses:
Header "Chi tiêu", top right two small avatars T and L, green badge "Đã lưu".
Large headline "Chia sẻ hành trình." with smaller subtitle "Rõ ràng từng khoản chi".
Budget card "Ngân sách chuyến đi" "5.000.000đ".
"Đã chi" "900.000đ", elegant progress bar filled 18 percent, small "Còn lại 4.100.000đ".
Dark forest-green settlement card with white text "Linh cần trả bạn" and large "300.000đ", subdued secondary line "Bạn đã trả 700.000đ · Linh đã trả 200.000đ". Outlined light button "Ghi nhận chuyển trả".
Section "Gần đây" with exactly three coherent transactions:
bed icon "Homestay" "Bạn trả · Chia đôi" amount "600.000đ".
food icon "Ăn uống" "Linh trả · Chia đôi" amount "200.000đ".
ticket icon "Vé tham quan" "Bạn trả hộ Linh" amount "100.000đ".
Prominent dark green button "+ Thêm khoản chi".
Same fixed bottom navigation with Chi tiêu selected.
Math invariant: A paid 600000 equal split plus 100000 entirely for B; B paid 200000 equal split; total 900000 and B owes A 300000. Keep these numbers exact.

Constraints: This is ONE polished coherent image, not a wireframe, not an implementation. Use accurate Vietnamese diacritics and the exact concise UI labels supplied. Every screen shares the same visual system and identical bottom-nav ordering. Prioritize readable text and realistic app hierarchy; avoid tiny dense copy, clipped buttons, invented charts, random filler text, watermarks, external brand logos, developer implementation text, or extra screens.
```

