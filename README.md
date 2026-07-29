# momo's melody studio — Server API

Backend REST API cho shop handmade **momo's melody studio** (phone charm, keychain, Mail Club subscription...). Xây dựng bằng Node.js + Express 5 + MongoDB (Mongoose), có đăng nhập Google OAuth, upload ảnh qua Cloudinary, gửi email qua Resend và cron job tự động.

## 1. Tech stack

| Thành phần      | Công nghệ                                         |
| --------------- | ------------------------------------------------- |
| Runtime         | Node.js (ESM — `"type": "module"`)                |
| Web framework   | Express 5                                         |
| Database        | MongoDB + Mongoose                                |
| Xác thực        | JWT (cookie httpOnly) + Passport Google OAuth 2.0 |
| Upload ảnh      | Multer + Cloudinary (`multer-storage-cloudinary`) |
| Gửi email       | Resend                                            |
| Mã hoá mật khẩu | bcryptjs                                          |
| Cron job        | node-cron                                         |

## 2. Cấu trúc thư mục

```
server/
├── config/           # Kết nối DB, Cloudinary, Passport, Resend
├── controllers/       # Business logic từng module
├── middleware/         # authMiddleware, adminMiddleware
├── models/             # Mongoose schemas
├── routes/             # Định nghĩa endpoint cho từng module
├── data/                # (không dùng trong runtime — xem mục Ghi chú)
├── index.js             # Entry point — khởi tạo app, middleware, routes, cron job
└── package.json
```

## 3. Cài đặt

### Yêu cầu

- Node.js >= 18
- MongoDB — **bắt buộc là Replica Set** (kể cả cụm 1 node trên MongoDB Atlas cũng
  đạt yêu cầu). Lý do: `createOrder` dùng `mongoose.startSession()` +
  `session.withTransaction()` để đảm bảo trừ kho và tạo đơn hàng là một thao
  tác nguyên tử — tính năng này **không chạy được** trên MongoDB standalone.
- Tài khoản Cloudinary, Resend, Google OAuth Client (xem mục 4).

### Các bước

```bash
# 1. Cài dependencies
npm install

# 2. Tạo file .env từ mẫu
cp .env.example .env
# rồi điền giá trị thật vào .env

# 3. Chạy ở chế độ dev (tự reload khi sửa code)
npm run dev

# hoặc chạy production
npm start
```

Server mặc định chạy tại `http://localhost:4000` (đổi qua biến `PORT`).

## 4. Biến môi trường

Xem chi tiết & giải thích từng biến trong [`.env.example`](./.env.example). Tóm tắt:

| Biến                    | Bắt buộc | Mô tả                                                        |
| ----------------------- | :------: | ------------------------------------------------------------ |
| `MONGODB_URI`           |    ✅    | Connection string MongoDB (phải là replica set)              |
| `JWT_SECRET`            |    ✅    | Chuỗi bí mật ký JWT                                          |
| `PORT`                  |    ❌    | Cổng chạy server (mặc định `4000`)                           |
| `NODE_ENV`              |    ❌    | `development` \| `production`                                |
| `GOOGLE_CLIENT_ID`      |    ✅    | Đăng nhập Google OAuth                                       |
| `GOOGLE_CLIENT_SECRET`  |    ✅    | Đăng nhập Google OAuth                                       |
| `CLOUDINARY_CLOUD_NAME` |    ✅    | Upload ảnh sản phẩm / banner / avatar                        |
| `CLOUDINARY_API_KEY`    |    ✅    | —                                                            |
| `CLOUDINARY_API_SECRET` |    ✅    | —                                                            |
| `RESEND_API_KEY`        |    ✅    | Gửi email xác nhận đơn hàng, Mail Club, liên hệ              |
| `CLIENT_URL`            |    ✅    | URL frontend (dùng cho CORS + redirect sau khi login Google) |
| `ADMIN_URL`             |    ✅    | URL trang quản trị (dùng cho CORS)                           |
| `ADMIN_EMAIL`           |    ✅    | Email nhận thông báo khi có người gửi liên hệ                |

> ⚠️ Lưu ý: callback Google OAuth (`routes/authRoutes.js`) hiện đang **hard-code**
> redirect về `http://localhost:5173` thay vì đọc từ `CLIENT_URL`. Cần sửa
> trước khi deploy production, nếu không đăng nhập Google sẽ luôn redirect
> nhầm về localhost.

## 5. API Endpoints

Tiền tố chung: `/api`. Các route đánh dấu 🔒 yêu cầu đăng nhập (`authMiddleware`),
🔒👑 yêu cầu quyền admin (`authMiddleware` + `adminMiddleware`).

### Auth — `/api/auth`

| Method | Path               | Ghi chú                        |
| ------ | ------------------ | ------------------------------ |
| POST   | `/register`        | Đăng ký email/password         |
| POST   | `/login`           | Đăng nhập email/password       |
| POST   | `/logout`          | Xoá cookie token               |
| GET    | `/me`              | 🔒 Lấy thông tin user hiện tại |
| PUT    | `/profile`         | 🔒 Cập nhật hồ sơ (kèm avatar) |
| PUT    | `/set-password`    | 🔒 Đặt/đổi mật khẩu            |
| GET    | `/google`          | Bắt đầu OAuth Google           |
| GET    | `/google/callback` | Callback OAuth Google          |

### Products — `/api/products`

| Method | Path   | Ghi chú                                    |
| ------ | ------ | ------------------------------------------ |
| GET    | `/`    | Public — filter `?category=&search=`       |
| GET    | `/:id` | Public                                     |
| POST   | `/`    | 🔒👑 Tạo sản phẩm (tối đa 4 ảnh)           |
| PUT    | `/:id` | 🔒👑 Cập nhật sản phẩm                     |
| DELETE | `/:id` | 🔒👑 Xoá sản phẩm (kèm xoá ảnh Cloudinary) |

### Orders — `/api/orders`

| Method | Path               | Ghi chú                                    |
| ------ | ------------------ | ------------------------------------------ | ----- | ----- |
| POST   | `/`                | 🔒 Tạo đơn hàng (transaction, trừ kho)     |
| GET    | `/my-orders`       | 🔒 Đơn hàng của user hiện tại              |
| GET    | `/`                | 🔒👑 Tất cả đơn hàng                       |
| GET    | `/pending-count`   | 🔒👑 Số đơn đang chờ xử lý                 |
| GET    | `/dashboard-stats` | 🔒👑 Thống kê tổng quan cho dashboard      |
| GET    | `/analytics`       | 🔒👑 Thống kê doanh thu theo `?period=week | month | year` |
| PUT    | `/:id/status`      | 🔒👑 Cập nhật trạng thái đơn               |
| PUT    | `/:id/confirm`     | 🔒👑 Xác nhận đơn (tuỳ chọn gửi email)     |

### Users/Customers — `/api/users`

| Method | Path            | Ghi chú                              |
| ------ | --------------- | ------------------------------------ |
| GET    | `/`             | 🔒👑 Danh sách khách hàng + thống kê |
| GET    | `/:id`          | 🔒👑 Chi tiết khách hàng             |
| PUT    | `/:id/nickname` | 🔒👑 Cập nhật nickname               |

### Flash Sale — `/api/flash-sales`

| Method | Path      | Ghi chú                       |
| ------ | --------- | ----------------------------- |
| GET    | `/active` | Public — flash sale đang chạy |
| GET    | `/`       | 🔒👑 Tất cả flash sale        |
| POST   | `/`       | 🔒👑 Tạo mới                  |
| PUT    | `/:id`    | 🔒👑 Cập nhật                 |
| DELETE | `/:id`    | 🔒👑 Xoá                      |

### Banners — `/api/banners`

| Method | Path      | Ghi chú                |
| ------ | --------- | ---------------------- |
| GET    | `/active` | Public                 |
| GET    | `/`       | 🔒👑 Tất cả banner     |
| POST   | `/`       | 🔒👑 Tạo mới (kèm ảnh) |
| PUT    | `/:id`    | 🔒👑 Cập nhật          |
| DELETE | `/:id`    | 🔒👑 Xoá               |

### Contact — `/api/contact`

| Method | Path        | Ghi chú                       |
| ------ | ----------- | ----------------------------- |
| POST   | `/`         | Public — gửi tin nhắn liên hệ |
| GET    | `/`         | 🔒👑 Xem tất cả tin nhắn      |
| PUT    | `/:id/read` | 🔒👑 Đánh dấu đã đọc          |
| DELETE | `/:id`      | 🔒👑 Xoá tin nhắn             |

### Mail Club — `/api/mail-club`

| Method | Path                 | Ghi chú                                      |
| ------ | -------------------- | -------------------------------------------- |
| POST   | `/subscribe`         | Public — đăng ký (yêu cầu form đang mở)      |
| GET    | `/my`                | 🔒 Gói đăng ký của user hiện tại             |
| GET    | `/`                  | 🔒👑 Tất cả subscription (filter `?status=`) |
| GET    | `/stats`             | 🔒👑 Thống kê Mail Club                      |
| PUT    | `/:id/confirm`       | 🔒👑 Xác nhận thanh toán → active            |
| PUT    | `/:id/renew`         | 🔒👑 Gia hạn                                 |
| PUT    | `/:id`               | 🔒👑 Cập nhật ghi chú / trạng thái           |
| POST   | `/send-reminders`    | 🔒👑 Gửi email nhắc gia hạn hàng loạt        |
| POST   | `/admin/create`      | 🔒👑 Admin tạo subscription thủ công         |
| PUT    | `/admin/:id`         | 🔒👑 Admin cập nhật subscription             |
| POST   | `/send-custom-email` | 🔒👑 Gửi email tuỳ chỉnh cho subscribers     |

### Mail Club Collections — `/api/mail-club-collections`

| Method | Path          | Ghi chú                            |
| ------ | ------------- | ---------------------------------- |
| GET    | `/`           | Public — collection đang active    |
| GET    | `/admin`      | 🔒👑 Tất cả collection             |
| POST   | `/`           | 🔒👑 Tạo collection                |
| POST   | `/:id/images` | 🔒👑 Thêm ảnh vào collection       |
| DELETE | `/:id/images` | 🔒👑 Xoá ảnh khỏi collection       |
| PUT    | `/:id`        | 🔒👑 Cập nhật thông tin collection |
| DELETE | `/:id`        | 🔒👑 Xoá collection                |

> ✅ Đã vá: trước đây các route admin ở trên chỉ dùng `authMiddleware` (thiếu
> `adminMiddleware`), khiến bất kỳ user đã đăng nhập nào cũng có thể tạo/sửa/xoá
> Mail Club Collection. Đã bổ sung `adminMiddleware` cho toàn bộ route để đồng
> nhất với các module admin khác.

### Mail Club Settings — `/api/mail-club-settings`

| Method | Path | Ghi chú                               |
| ------ | ---- | ------------------------------------- |
| GET    | `/`  | Public — trạng thái form đăng ký      |
| PUT    | `/`  | 🔒👑 Cập nhật trạng thái mở/đóng form |

### Notifications — `/api/notifications`

| Method | Path             | Ghi chú                           |
| ------ | ---------------- | --------------------------------- |
| GET    | `/`              | 🔒 Thông báo của user (tối đa 30) |
| PUT    | `/:id/read`      | 🔒 Đánh dấu 1 thông báo đã đọc    |
| PUT    | `/mark-all-read` | 🔒 Đánh dấu tất cả đã đọc         |

## 6. Cron job

`index.js` đăng ký cron chạy **mỗi ngày lúc 00:01** (`"1 0 * * *"`), gọi
`autoExpireSubscriptions()` để tự động chuyển các Mail Club subscription đã
hết hạn (`endDate < now` và `status: "active"`) sang `status: "expired"`.

## 7. Ghi chú / hạn chế đã biết

- `data/productsRaw.js` hiện **không được import ở bất kỳ đâu** trong server —
  là dữ liệu seed cũ, giữ lại để tham khảo cấu trúc sản phẩm mẫu, không ảnh
  hưởng runtime. Có thể xoá hoặc chuyển vào một script seed riêng nếu cần dùng lại.
- Giá gói Mail Club (`monthly: 135.000đ`, `quarterly: 364.500đ`) và thông tin
  chuyển khoản hiện đang hard-code trong `controllers/mailClubController.js`
  và `controllers/orderController.js`. Muốn đổi giá/ngân hàng phải sửa code
  và deploy lại — nên cân nhắc chuyển các giá trị này vào
  `MailClubSettings`/config tập trung trong tương lai.
- Transaction khi tạo đơn hàng (`createOrder`) yêu cầu MongoDB Replica Set —
  xem lại mục 3.

## 8. License

ISC (nội bộ dự án).
