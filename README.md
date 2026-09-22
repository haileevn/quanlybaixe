# Sổ bãi xe

Ứng dụng quản lý bãi xe cho chủ bãi ở Việt Nam: ghi xe tháng, thu tiền, xem ai tới hạn / đang nợ. Giao diện tiếng Việt, tối ưu điện thoại.

Phase 1: nền tảng, auth, xe tháng. Phase 2: thu–chi, sổ quỹ, công nợ, nhắc hạn, VietQR. Phase 3: phòng trọ, mặt bằng, dịch vụ, sạc xe điện. Phase 4: báo cáo biểu đồ, Excel, in/PDF.

## Chạy local

Cần Node 20+, MariaDB/MySQL. Redis khuyên dùng (OTP + worker); thiếu Redis thì OTP/rate-limit chạy bộ nhớ tạm.

```bash
cp .env.example .env
# Sửa DATABASE_URL, AUTH_SECRET
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

Mở http://localhost:3033

Tài khoản mẫu (sau khi seed):

- Chủ bãi demo: `demo@baixe.vn` / `Demo@123456`
- Quản trị hệ thống: `admin@quanlybaixe.vn` / `Admin@123456` → vào `/admin`

Tạo MariaDB nhanh (Docker):

```bash
docker run -d --name baixe-db \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=quan_ly_bai_xe \
  -e MYSQL_USER=baixe \
  -e MYSQL_PASSWORD=baixe \
  -p 3306:3306 \
  mariadb:11
```

Redis (tuỳ chọn):

```bash
docker run -d --name baixe-redis -p 6379:6379 redis:7
```

Worker nhắc hạn (07:00 giờ VN, cần Redis):

```bash
npm run worker
```

## Script

- `npm run dev` — Next.js (Turbopack)
- `npm run build` / `npm start` — production
- `npm run db:push` — đẩy schema
- `npm run db:seed` — gói dịch vụ + tenant demo
- `npm run worker` — BullMQ nhắc hạn

## Deploy CloudPanel + PM2 + Nginx (khung)

Chi tiết harden production thuộc Phase 5. Các bước tối thiểu:

1. Trên VPS CloudPanel: tạo site Node.js, cài Node 20, MariaDB, Redis.
2. Clone code vào thư mục site, `cp .env.example .env`, điền `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` (https domain), SMTP, `REDIS_URL`.
3. `npm ci`, `npx prisma generate`, `npx prisma migrate deploy` (hoặc `db push` lần đầu), `npm run db:seed`, `npm run build`.
4. Sửa path trong `ecosystem.config.cjs`, chạy `pm2 start ecosystem.config.cjs`.
5. Gắn `nginx.conf.example` vào vhost CloudPanel (reverse proxy cổng 3000, phục vụ `/uploads/`).
6. Trỏ HTTPS Let's Encrypt trong CloudPanel.
7. Thư mục `public/uploads` phải ghi được bởi user chạy PM2.

## Ghi chú Phase 3

- Bật module ở Cài đặt / wizard đăng ký: phòng trọ, mặt bằng, dịch vụ, sạc
- Phòng: cho thuê, thu tháng, thu điện nước
- Ô / ki-ốt: cho thuê và thu tháng
- Dịch vụ: loại tự đặt (một lần / tháng)
- Sạc: trụ, gói kWh/giờ/tháng, bắt đầu/kết thúc, cảnh báo nếu sạc > 8 giờ

## Ghi chú Phase 4

- Trang `/bao-cao`: thu tháng này so tháng trước, phòng/mặt bằng đang thuê, đang nợ
- Biểu đồ 12 tháng thu–chi và thu theo nguồn (chỉ chủ bãi)
- Xuất Excel: sổ thu chi, danh sách xe, công nợ, hoá đơn
- In / lưu PDF bằng trình duyệt (`window.print()`), không thêm thư viện PDF
- Nhân viên không vào báo cáo. Quản lý xem xe + công nợ, không xem lãi/thu–chi/hoá đơn

## SMS cho khách

Nút **Nhắn SMS** trên tới hạn, công nợ, chi tiết xe/phòng/ô. Nhắc hạn tự động và nhắc hàng loạt cũng gửi SMS.

Cấu hình nhà mạng trong `.env` (`SMS_PROVIDER=speedsms|esms|twilio`). Để `log` thì tin chỉ ghi sổ, in ra console — dùng khi dev.

## Gói, dịch vụ thêm, QR

- `/goi-dich-vu`: chọn gói 1 / 3 (−8%) / 12 tháng (−15%) + dịch vụ thêm, lấy QR. Tiền vào (webhook SePay hoặc Super Admin duyệt) thì tự đổi gói / mở dịch vụ. Gói 1 tháng: nếu chuyển nhiều hơn gói đang chọn thì hệ thống lên gói cao hơn.
- Super Admin `/admin/goi`: sửa giá gói và giá dịch vụ thêm.
- Chủ bãi điền STK mặc định và STK theo từng bãi ở Cài đặt. QR thu khách ưu tiên STK bãi.
- Khách tự tra hạn: `/tra-cuu` (3 số cuối biển + SĐT) → QR đóng 1 hoặc 3 tháng tại `/thanh-toan/[token]`.
- Webhook `POST /api/thanh-toan/webhook` khớp nội dung + số tiền: tự ghi thu khách hoặc duyệt gói SaaS. Máy dev có thể `SAAS_AUTO_APPROVE=1`.
- Nhân viên có thể gửi ảnh chứng từ; khách gửi ảnh tại link công khai. Duyệt ở **Thu tiền**. Biên lai in: `/bien-lai/[token]`, SMS kèm link sau khi thu.

Chưa làm: Super Admin đầy đủ + PWA offline (Phase 5), Socket.io
