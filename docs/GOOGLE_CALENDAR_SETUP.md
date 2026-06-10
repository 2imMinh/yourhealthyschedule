# Đồng bộ Google Calendar (Mức 2) — Hướng dẫn cấu hình

Tính năng đẩy lịch của app sang một lịch riêng tên **"Your Healthy Schedule"** trong
Google Calendar của người dùng. **Chỉ dành cho Premium.** Một chiều (app → Google);
mỗi lần bấm "Đồng bộ Google" sẽ xoá + ghi lại khoảng thời gian đang xem (nên không trùng).

Để chạy được, cần cấu hình 2 nơi: **Google Cloud Console** và **Clerk**.

## A. Google Cloud Console
1. Vào https://console.cloud.google.com → tạo (hoặc chọn) một Project.
2. **APIs & Services → Library** → tìm **Google Calendar API** → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** → Create.
   - Điền tên app, email hỗ trợ, email liên hệ.
   - **Scopes**: Add → thêm `https://www.googleapis.com/auth/calendar.events`
     (đây là scope "nhạy cảm"). Save.
   - **Test users**: Add → thêm email Google của bạn (và bạn bè muốn dùng thử).
     Ở chế độ **Testing**, được tối đa ~100 test user mà KHÔNG cần Google xét duyệt.
     (Muốn mở cho mọi người công khai mới cần submit xét duyệt — có thể mất thời gian.)
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized redirect URIs**: dán URI mà Clerk cung cấp ở bước B (quay lại điền sau).
   - Tạo xong, copy **Client ID** và **Client secret**.

## B. Clerk Dashboard
1. **User & Authentication → SSO Connections (Social) → Google** → bật.
2. Chọn **Use custom credentials** (bắt buộc, để thêm scope tuỳ chỉnh):
   - Dán **Client ID** và **Client secret** từ bước A.
   - Clerk sẽ hiển thị **Authorized redirect URI** → copy nó, quay lại bước A.4 dán vào Google.
3. Ở mục **Scopes** của kết nối Google, thêm:
   `https://www.googleapis.com/auth/calendar.events`
4. Save.

## C. Người dùng
- Phải **Đăng nhập bằng Google** (và bấm Cho phép quyền lịch khi được hỏi).
- Ai đã đăng nhập bằng email/mật khẩu trước đó sẽ KHÔNG có token Google → nút sẽ báo
  cần đăng nhập bằng Google. Nếu đã đăng nhập bằng Google TRƯỚC khi bạn thêm scope, hãy
  **đăng xuất rồi đăng nhập lại bằng Google** để cấp lại quyền lịch.
- Chỉ tài khoản **Premium** (hoặc email trong FOUNDER_EMAILS) mới dùng được.

## Lưu ý
- App đẩy lịch của **khoảng đang xem** (Premium = 7 ngày). Sau khi Tạo lại lịch, bấm
  "Đồng bộ Google" lại để cập nhật.
- Sự kiện nằm trong lịch riêng "Your Healthy Schedule" — bạn có thể ẩn/xoá lịch đó trong
  Google bất cứ lúc nào mà không đụng tới lịch chính.
- Ở chế độ Testing, Google sẽ hiện cảnh báo "ứng dụng chưa được xác minh" khi đăng nhập —
  test user bấm "Advanced → Continue" là qua. Bình thường với MVP.
