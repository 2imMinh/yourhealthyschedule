# Hướng dẫn Triển khai — AI Healthy Scheduler (Hạng mục 8/8)

Một ứng dụng Next.js 15 duy nhất, triển khai trên **Vercel**, với **Neon** (PostgreSQL được quản lý), **Clerk** (xác thực), **Stripe** (thanh toán) và **OpenAI** (lớp AI). Hướng dẫn này đưa bạn từ một bản clone sạch đến một bản triển khai chạy thực tế.

---

## 0. Yêu cầu trước

- Node.js ≥ 20 và npm
- Tài khoản: Vercel, Neon (hoặc bất kỳ Postgres được quản lý nào), Clerk, Stripe, OpenAI
- Stripe CLI (để kiểm thử webhook ở local): `stripe`
- Git

---

## 1. Cài đặt ở local

```bash
git clone <your-repo> ai-healthy-scheduler
cd ai-healthy-scheduler
npm install                      # chạy `prisma generate` qua postinstall

# Thêm các thành phần shadcn/ui mà các component import vào:
npx shadcn@latest add button card checkbox badge alert dialog tabs \
  input label slider switch select skeleton separator dropdown-menu sonner tooltip

cp .env.example .env.local       # rồi điền giá trị thật (xem các mục bên dưới)
```

Gắn toaster một lần (để các thông báo `sonner` hiển thị). Trong `src/app/(app)/layout.tsx`, thêm `<Toaster />` từ `@/components/ui/sonner` gần gốc của khung ứng dụng (hoặc trong root layout).

---

## 2. Cơ sở dữ liệu (Neon)

1. Tạo một project Neon → sao chép hai chuỗi kết nối.
2. Trong `.env.local`, đặt:
   - `DATABASE_URL` → chuỗi **pooled** (có host `-pooler` / `pgbouncer=true`). Dùng khi chạy ứng dụng (runtime).
   - `DIRECT_URL` → chuỗi **direct**. Chỉ dùng cho migration.
3. Tạo schema và sinh client:

```bash
npx prisma migrate dev --name init    # tạo bảng từ prisma/schema.prisma
npm run db:seed                        # dữ liệu mẫu (tùy chọn — xem lưu ý bên dưới)
```

> **Tại sao cần hai URL?** Các hàm serverless/edge mở rất nhiều kết nối ngắn; chuỗi pooled (PgBouncer) ngăn việc cạn kiệt kết nối, trong khi migration cần một kết nối trực tiếp. Việc tách này đã được cấu hình sẵn trong `schema.prisma`.

> **Lưu ý về seed:** id của user mẫu sẽ không khớp với một phiên Clerk thật, nên đừng kỳ vọng *đăng nhập* bằng nó — nó dùng để kiểm thử engine/API. User thật được tạo bởi webhook của Clerk (hoặc tạo lười (lazy) ở request đầu tiên).

**SQL tăng cường cho production** (chạy như một migration tiếp theo; Prisma không biểu diễn được những thứ này — lấy từ tài liệu thiết kế CSDL): partial index loại trừ `deletedAt IS NOT NULL`, các ràng buộc `CHECK` (`estimatedMinutes > 0`, `endTime > startTime`), và phân mảnh theo dải tháng (range partitioning) cho các bảng dung lượng lớn khi chúng phình to.

---

## 3. Clerk (xác thực)

1. Tạo một ứng dụng Clerk → sao chép các API key vào `.env.local`:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
2. Đặt các biến môi trường URL đăng nhập/đăng ký (đã có trong `.env.example`) để Clerk điều hướng đến `/sign-in` và `/sign-up`.
3. **Webhook:** trong Clerk → Webhooks → thêm endpoint `https://<your-domain>/api/webhooks/clerk`, đăng ký các sự kiện `user.created`, `user.updated`, `user.deleted`. Sao chép signing secret → `CLERK_WEBHOOK_SECRET`.
4. Xác nhận `src/middleware.ts` để `/api/webhooks/*` ở chế độ public (nó đã như vậy) — webhook phải bỏ qua xác thực.

---

## 4. Stripe (thanh toán)

1. Tạo một **Price định kỳ (recurring)** cho gói Premium → sao chép id của nó vào cả hai:
   - `STRIPE_PREMIUM_PRICE_ID` (phía server) và `NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID` (phía client; trang pricing đọc giá trị này).
2. Sao chép `STRIPE_SECRET_KEY`.
3. **Webhook (production):** Stripe Dashboard → Developers → Webhooks → thêm `https://<your-domain>/api/webhooks/stripe`, đăng ký:
   - `checkout.session.completed`
   - `customer.subscription.created` / `.updated` / `.deleted`
   - `invoice.payment_succeeded` / `.payment_failed`
   Sao chép signing secret → `STRIPE_WEBHOOK_SECRET`.
4. **Webhook (local):**

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# sao chép chuỗi whsec_... được in ra vào STRIPE_WEBHOOK_SECRET trong .env.local
```

> Webhook là nguồn chân lý (source of truth) cho quyền lợi (entitlements) — nó cập nhật `User.subscriptionTier` và ghi bản ghi `Subscription`. Nếu không cấu hình, thanh toán vẫn thành công nhưng Premium sẽ không bao giờ được cấp.

---

## 5. OpenAI (lớp AI)

Đặt `OPENAI_API_KEY` và (tùy chọn) `OPENAI_MODEL` (mặc định là `gpt-4o-mini`). Lớp AI suy giảm một cách "duyên dáng" (graceful degradation) — việc phân tích task và gợi ý thay thế sẽ chuyển về dùng quy tắc (rules) nếu thiếu key — nên bộ lập lịch cốt lõi vẫn hoạt động mà không cần nó.

---

## 6. Chạy ở local

```bash
npm run dev        # http://localhost:3000
```

Kiểm thử nhanh: đăng ký → vào `/dashboard` → Settings → đặt thói quen (routine) → Tasks → thêm một task → Dashboard → **Generate today** → tích hoàn thành một block.

---

## 7. Triển khai lên Vercel

1. Push lên GitHub và **Import Project** trong Vercel.
2. **Biến môi trường:** thêm tất cả các key từ `.env.local` vào project Vercel (cả Production và Preview). Đặt `NEXT_PUBLIC_APP_URL` thành domain thật của bạn (ví dụ `https://app.yourdomain.com`).
3. **Lệnh build** là `npm run build` (lệnh này chạy `prisma generate` trước — đã có sẵn trong `package.json`).
4. **Chạy migration trên production** (quá trình build của Vercel *không* tự migrate). Chạy ở local trỏ tới prod, hoặc dùng như một bước deploy:

```bash
# với DATABASE_URL / DIRECT_URL của prod đã được export:
npx prisma migrate deploy
```

5. Triển khai. Sau đó **cập nhật cả hai URL webhook** (Clerk + Stripe) sang domain production và sao chép lại signing secret của chúng vào biến môi trường Vercel nếu chúng khác với local.

> **Lựa chọn cơ sở dữ liệu:** Postgres "first-party" của Vercel hiện chạy trên Neon, nên dùng Vercel Postgres hay một project Neon độc lập đều được. Hãy giữ API trên runtime Node của Vercel (không phải Edge) — Prisma cần Node.

---

## 8. Danh sách kiểm tra sau khi triển khai

- [ ] Đăng ký tạo ra một user trong CSDL (kiểm tra lượt gửi webhook Clerk → 200).
- [ ] Profile lưu được; dữ liệu không hợp lệ (min sleep > target) trả về lỗi 400 rõ ràng.
- [ ] **Generate** tạo ra lịch; ngủ <6h hiển thị cảnh báo.
- [ ] Tích một block ghi `CompletionLog`; hoàn thành block của task làm task tiến triển.
- [ ] Analytics hiển thị sau một, hai ngày tích hoàn thành.
- [ ] Nâng cấp → Stripe Checkout → quay lại → **Premium được cấp** (Stripe webhook → 200, `subscriptionTier = PREMIUM`).
- [ ] Chế độ Emergency: user free nhận 402; user premium chạy được; dùng lần thứ hai trong vòng 48h nhận 429.
- [ ] Cổng quản lý thanh toán (billing portal) mở được cho user premium.

---

## 9. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp / cách khắc phục |
|---|---|
| `Too many connections` trên Postgres | Đang dùng URL direct khi runtime — đặt `DATABASE_URL` là chuỗi **pooled**. |
| Thanh toán xong nhưng không có Premium | Webhook Stripe chưa cấu hình, `STRIPE_WEBHOOK_SECRET` sai, hoặc `/api/webhooks/stripe` không ở chế độ public trong middleware. |
| Webhook báo 400 "Invalid signature" | Body bị parse trước khi xác minh (ta dùng `req.text()`), hoặc secret không khớp với môi trường này. |
| User không được tạo | Thiếu webhook Clerk — bộ resolver lười vẫn tạo user ở request đầu tiên, nên hãy kiểm tra lượt gửi `/api/webhooks/clerk`. |
| Lỗi Prisma trên Vercel | Đảm bảo `prisma generate` chạy trong build (đã có) và `serverExternalPackages` bao gồm Prisma (đã có trong `next.config.ts`). |
| Lịch lệch một giờ quanh thời điểm DST | Đây là điểm hạn chế đã biết của MVP — các hàm xử lý múi giờ trong `schedule.service.ts` cộng phút tuyệt đối; cách sửa là dùng phép tính theo giờ-treo-tường (wall-clock). |
| AI phân tích ra kết quả chung chung | Thiếu/sai `OPENAI_API_KEY` → đang dùng heuristic dự phòng (đúng như thiết kế). |

---

## 10. Tóm tắt kiến trúc (một đoạn)

Request đi vào các Route Handler của Next.js, được Clerk xác thực và Zod kiểm tra hợp lệ. **Engine lập lịch tất định** (`src/server/scheduling/*`) là thuần túy và không phụ thuộc framework — nó quyết định tính khả thi, bảo vệ giấc ngủ/bữa ăn/tập thể dục, ưu tiên theo deadline, phát hiện quá tải qua một phép kiểm tra EDF chính xác, và di chuyển task. **Lớp service** xử lý mọi vấn đề về múi giờ và Prisma. **OpenAI chỉ đóng vai trò tư vấn** (phân tích ngôn ngữ tự nhiên, gợi ý thay thế) đứng sau một interface có thể thay thế được, với các phương án dự phòng dựa trên quy tắc — nó không bao giờ quyết định tính khả thi. Webhook của Stripe là nguồn chân lý cho quyền lợi. Sự tách bạch đó — thuật toán chính xác cho tính đúng đắn, LLM cho phần "đánh bóng" — chính là cốt lõi của thiết kế.

---

*Hết Hướng dẫn Triển khai — và cũng là kết thúc quá trình xây dựng MVP gồm 8 phần.*
