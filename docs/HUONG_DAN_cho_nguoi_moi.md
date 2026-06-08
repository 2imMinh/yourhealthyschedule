# Hướng dẫn Đưa Ứng dụng Lên Mạng — Dành cho người KHÔNG biết lập trình

Đây là phiên bản giải thích cặn kẽ, từng bước một. Bạn không cần biết code, chỉ cần làm theo đúng thứ tự, chép và dán cẩn thận. Hãy đọc chậm và đừng bỏ bước.

> **Cần chuẩn bị tâm lý:** việc này mất khoảng **1–2 giờ** cho lần đầu. Bạn sẽ phải tạo vài tài khoản miễn phí và chép vài "chìa khóa" (key) qua lại. Nếu một bước báo lỗi, đừng hoảng — phần cuối có bảng "Lỗi thường gặp".

---

## Phần A. Hiểu nhanh: chúng ta đang làm gì?

Ứng dụng này giống như một **nhà hàng**. Để mở cửa, bạn cần thuê 5 "nhà cung cấp dịch vụ" (đều có gói miễn phí để bắt đầu):

| Dịch vụ | Vai trò dễ hiểu |
|---|---|
| **Vercel** | Mặt bằng nhà hàng — nơi ứng dụng "sống" và mọi người truy cập được. |
| **Neon** | Kho chứa đồ — nơi lưu dữ liệu (tài khoản, công việc, lịch của người dùng). |
| **Clerk** | Bảo vệ cửa — lo việc đăng ký, đăng nhập. |
| **Stripe** | Quầy thu ngân — lo việc thu tiền gói Premium. |
| **OpenAI** | Trợ lý thông minh — lo phần AI (hiểu câu "làm bài luận ~3 tiếng, hạn thứ Sáu"). |

Công việc của bạn là: tải mã nguồn về, điền "chìa khóa" của 5 dịch vụ trên vào, rồi bấm nút đưa lên mạng.

> **"Chìa khóa" (API key) là gì?** Là một dãy ký tự bí mật mà mỗi dịch vụ cấp cho bạn, để ứng dụng "chứng minh đây là tài khoản của tôi". Hãy coi nó như mật khẩu — **không chia sẻ công khai**.

---

## Phần B. Cài 3 công cụ trên máy tính

Làm một lần duy nhất.

1. **Node.js** (bộ máy chạy ứng dụng)
   - Vào trang `https://nodejs.org` → tải bản **LTS** → cài như cài phần mềm bình thường (bấm Next liên tục).
2. **Visual Studio Code** (gọi tắt VS Code — phần mềm để mở và sửa file)
   - Vào `https://code.visualstudio.com` → tải → cài.
3. **Git** (công cụ tải mã nguồn)
   - Vào `https://git-scm.com/downloads` → tải → cài (bấm Next liên tục).

**Kiểm tra đã cài xong chưa:** mở **Terminal** (xem cách mở ngay dưới đây), gõ dòng sau rồi nhấn Enter:
```bash
node -v
```
Nếu hiện ra một con số (ví dụ `v20.11.0`) là thành công.

> **Terminal là gì và mở ở đâu?** Là cửa sổ để bạn "ra lệnh" cho máy bằng chữ.
> - **Cách dễ nhất:** mở VS Code → trên thanh menu chọn **Terminal → New Terminal**. Một ô đen/trắng hiện ra ở dưới — đó là Terminal.

---

## Phần C. Tải mã nguồn về máy

1. Trong VS Code, mở Terminal (Terminal → New Terminal).
2. Chép từng dòng dưới đây, dán vào Terminal, nhấn Enter sau **mỗi** dòng. Thay `<địa-chỉ-mã-nguồn>` bằng đường link kho mã của bạn (trên GitHub).

```bash
git clone <địa-chỉ-mã-nguồn> ai-healthy-scheduler
cd ai-healthy-scheduler
```

> Dòng `cd ai-healthy-scheduler` nghĩa là "đi vào thư mục vừa tải về". Mọi lệnh sau đều phải chạy bên trong thư mục này.

3. Mở thư mục đó trong VS Code: menu **File → Open Folder** → chọn thư mục `ai-healthy-scheduler`.

---

## Phần D. Cài các "linh kiện" của ứng dụng

Trong Terminal, gõ lần lượt (chờ mỗi lệnh chạy xong mới gõ lệnh tiếp):

```bash
npm.cmd install
```
> Lệnh này tải về tất cả "linh kiện" ứng dụng cần. Sẽ mất vài phút và hiện nhiều dòng chữ — đó là bình thường.
> Nếu bạn đang dùng PowerShell mà thấy lỗi kiểu `npm.ps1 cannot be loaded because running scripts is disabled on this system`, hãy dùng lệnh `npm.cmd install` thay cho `npm install`, hoặc đổi Terminal sang **Command Prompt** rồi chạy lại.

```bash
npx.cmd shadcn@latest add button card checkbox badge alert dialog tabs input label slider switch select skeleton separator dropdown-menu sonner tooltip
```
> Lệnh này thêm các thành phần giao diện (nút bấm, ô nhập, thẻ...). Nếu nó hỏi xác nhận, cứ nhấn Enter để đồng ý.
> Nếu PowerShell chặn `npx` tương tự, dùng `npx.cmd` thay cho `npx`.

---

## Phần E. Tạo file "bảng chìa khóa" (.env.local)

Đây là file chứa toàn bộ chìa khóa bí mật. Gõ lệnh sau để tạo nó từ mẫu có sẵn:

```bash
cp .env.example .env.local
```

Sau đó trong VS Code, ở khung bên trái, tìm và bấm vào file tên **`.env.local`** để mở ra. Bạn sẽ thấy nhiều dòng dạng `TÊN="giá trị"`. Nhiệm vụ của các phần tiếp theo là **lấy giá trị thật** từ 5 dịch vụ rồi **dán vào giữa hai dấu ngoặc kép** `"..."`.

> ⚠️ **Quan trọng:** chỉ thay phần trong ngoặc kép. Đừng đổi tên ở bên trái dấu `=`. Sau khi dán xong nhớ **lưu file** (Ctrl+S, hoặc Cmd+S trên Mac).

---

## Phần F. Lấy chìa khóa từ từng dịch vụ

Làm lần lượt. Mỗi mục: tạo tài khoản → vào đúng trang → chép chìa khóa → dán vào `.env.local`.

### F1. Neon (kho dữ liệu)
1. Vào `https://neon.tech` → đăng ký miễn phí → tạo một **Project** mới.
2. Tìm mục **Connection string** (chuỗi kết nối). Neon thường cho hai loại:
   - Loại có chữ **`-pooler`** trong địa chỉ → dán vào `DATABASE_URL`.
   - Loại **không** có `-pooler` → dán vào `DIRECT_URL`.
3. Lưu file.

### F2. Clerk (đăng nhập)
1. Vào `https://clerk.com` → đăng ký → tạo một **Application**.
2. Vào mục **API Keys**, chép:
   - `Publishable key` → dán vào `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `Secret key` → dán vào `CLERK_SECRET_KEY`
3. (Phần Webhook của Clerk sẽ làm sau, ở Phần I.)

### F3. Stripe (thanh toán)
1. Vào `https://stripe.com` → đăng ký → bật **Test mode** (chế độ thử) ở góc trên để không tính tiền thật.
2. Vào **Developers → API keys**, chép `Secret key` → dán vào `STRIPE_SECRET_KEY`.
3. Tạo gói Premium: vào **Product catalog → Add product**, đặt giá định kỳ (recurring) theo tháng. Sau khi tạo, chép **Price ID** (dạng `price_...`) và dán vào **cả hai** dòng:
   - `STRIPE_PREMIUM_PRICE_ID`
   - `NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID`

### F4. OpenAI (AI)
1. Vào `https://platform.openai.com` → đăng ký → vào **API keys** → tạo key mới → chép → dán vào `OPENAI_API_KEY`.
> Lưu ý: OpenAI có thể yêu cầu nạp một khoản nhỏ để dùng. Nếu bạn chưa muốn dùng AI, có thể bỏ trống — ứng dụng vẫn chạy, chỉ là phần AI sẽ dùng cách đoán đơn giản hơn.

### F5. Địa chỉ ứng dụng
- Khi chạy thử trên máy, để dòng này như mặc định:
  - `NEXT_PUBLIC_APP_URL="http://localhost:3000"`
  - (Sau khi lên mạng, bạn sẽ đổi thành địa chỉ thật — Phần H.)

Nhớ **lưu file** sau khi dán xong tất cả.

---

## Phần G. Tạo bảng trong kho dữ liệu & chạy thử trên máy

1. Tạo cấu trúc bảng trong Neon:
```bash
npx.cmd prisma migrate dev --name init
```
> Lệnh này "dựng kệ" trong kho dữ liệu để chứa người dùng, công việc, lịch.

2. (Tùy chọn) Thêm dữ liệu mẫu để có cái mà xem:
```bash
npm.cmd run db:seed
```

3. Chạy thử ứng dụng:
```bash
npm.cmd run dev
```
> Khi thấy dòng chữ báo `localhost:3000`, hãy mở trình duyệt và vào địa chỉ **`http://localhost:3000`**. Ứng dụng đang chạy trên máy bạn!

4. **Thử một vòng:** Đăng ký tài khoản → vào Settings đặt giờ ngủ/làm việc → vào Tasks thêm một việc → vào Today bấm **Generate** → tích hoàn thành một mục.

> Để **dừng** ứng dụng: bấm vào Terminal rồi nhấn **Ctrl + C**.

---

## Phần H. Đưa ứng dụng lên mạng (Vercel)

Đến đây ứng dụng mới chỉ chạy trên máy bạn. Giờ đưa nó lên Internet để ai cũng truy cập được.

1. Đưa mã nguồn lên **GitHub** (nếu chưa có): tạo tài khoản tại `https://github.com`, tạo một kho (repository) mới, rồi làm theo hướng dẫn GitHub hiện ra để "push" mã lên. (Nếu phần này khó, đây là chỗ đáng nhờ một người rành kỹ thuật giúp 10 phút.)
2. Vào `https://vercel.com` → đăng ký bằng tài khoản GitHub → bấm **Add New → Project** → chọn kho mã vừa tạo → **Import**.
3. Trước khi bấm Deploy, mở mục **Environment Variables**. Đây là bước **quan trọng nhất**: chép **toàn bộ** các dòng trong file `.env.local` của bạn vào đây (mỗi dòng là một biến: tên ở ô trái, giá trị ở ô phải).
   - Riêng `NEXT_PUBLIC_APP_URL`: đổi thành địa chỉ thật mà Vercel cấp cho bạn (ví dụ `https://ten-app-cua-ban.vercel.app`).
4. Bấm **Deploy** và chờ vài phút.
5. Sau khi xong, dựng bảng cho kho dữ liệu bản chạy thật. Cách đơn giản: trong Terminal trên máy bạn, chạy:
```bash
npx.cmd prisma migrate deploy
```
> (Lệnh này dùng đúng `DATABASE_URL`/`DIRECT_URL` của Neon mà bạn đã điền.)

---

## Phần I. Nối "webhook" (bước hay bị quên)

Webhook giống như **chuông báo**: khi có người đăng ký hoặc thanh toán, dịch vụ sẽ "bấm chuông" báo cho ứng dụng của bạn. Thiếu bước này thì: thanh toán xong nhưng khách **không** được nâng cấp Premium.

### Clerk
- Vào Clerk → **Webhooks → Add Endpoint**.
- Địa chỉ: `https://<địa-chỉ-thật-của-bạn>/api/webhooks/clerk`
- Chọn các sự kiện: `user.created`, `user.updated`, `user.deleted`.
- Chép **Signing Secret** mà Clerk cấp → vào Vercel thêm biến `CLERK_WEBHOOK_SECRET` với giá trị đó.

### Stripe
- Vào Stripe → **Developers → Webhooks → Add endpoint**.
- Địa chỉ: `https://<địa-chỉ-thật-của-bạn>/api/webhooks/stripe`
- Chọn các sự kiện: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
- Chép **Signing secret** → vào Vercel thêm biến `STRIPE_WEBHOOK_SECRET` với giá trị đó.

> Sau khi thêm/sửa biến trên Vercel, vào tab **Deployments** bấm **Redeploy** để áp dụng.

---

## Phần J. Kiểm tra lần cuối (đánh dấu ✔ từng mục)

- [ ] Mở địa chỉ thật → trang chủ hiện ra.
- [ ] Đăng ký được tài khoản, đăng nhập vào thấy trang **Today**.
- [ ] Vào Settings lưu được thói quen.
- [ ] Bấm **Generate** → có lịch hiện ra.
- [ ] Tích hoàn thành một mục → không báo lỗi.
- [ ] Bấm Upgrade → trang thanh toán Stripe hiện ra (dùng thẻ thử của Stripe: số `4242 4242 4242 4242`, ngày hết hạn bất kỳ trong tương lai, CVC bất kỳ).
- [ ] Sau khi "thanh toán thử", tài khoản chuyển thành Premium.

---

## Phần K. Lỗi thường gặp (bằng tiếng dễ hiểu)

| Bạn thấy | Nghĩa là gì & sửa thế nào |
|---|---|
| `command not found: npm` | Chưa cài Node.js đúng cách. Cài lại Phần B, đóng và mở lại Terminal. |
| `npm.ps1 cannot be loaded because running scripts is disabled on this system` | PowerShell đang chặn lệnh `npm`. Dùng `npm.cmd` / `npx.cmd` thay thế, hoặc mở Terminal kiểu **Command Prompt**. |
| Lệnh báo "không tìm thấy thư mục" | Bạn đang đứng sai chỗ. Gõ `cd ai-healthy-scheduler` để vào đúng thư mục. |
| `Too many connections` | Dán nhầm chuỗi kết nối. `DATABASE_URL` phải là loại có `-pooler`. |
| Trang trắng / lỗi sau khi deploy | Thường do **thiếu một biến môi trường** trên Vercel. Đối chiếu lại với `.env.local`, thêm cho đủ, rồi Redeploy. |
| Thanh toán xong nhưng không lên Premium | Chưa nối webhook Stripe (Phần I) hoặc dán sai `STRIPE_WEBHOOK_SECRET`. |
| Đăng nhập lỗi | Sai key Clerk, hoặc địa chỉ ứng dụng (`NEXT_PUBLIC_APP_URL`) chưa đúng với domain thật. |
| AI trả lời chung chung | Chưa điền `OPENAI_API_KEY` (ứng dụng tự dùng cách đoán đơn giản — vẫn chạy được). |

---

## Phần L. Khi nào nên nhờ người rành kỹ thuật?

Bạn hoàn toàn có thể tự làm hết. Nhưng có **2 chỗ** nếu vướng thì nhờ một bạn lập trình giúp ~15 phút sẽ nhanh hơn nhiều:
1. **Đưa mã lên GitHub lần đầu** (Phần H, bước 1).
2. **Chạy lệnh `prisma migrate` cho bản thật** nếu nó báo lỗi kết nối.

Ngoài ra, hãy giữ file `.env.local` **bí mật tuyệt đối** — đừng gửi cho ai, đừng đăng lên mạng. Nó chứa mọi chìa khóa của bạn.

---

*Chúc bạn triển khai thành công! Cứ làm chậm rãi, đúng thứ tự, là sẽ chạy.*
