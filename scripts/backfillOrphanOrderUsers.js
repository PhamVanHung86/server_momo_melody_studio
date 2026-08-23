// 🌸 Script vá dữ liệu 1 lần: gán lại `Order.user` (và
// `MailClubSubscription.userId`) cho các bản ghi bị lưu thành "khách vãng
// lai" (user: null) MẶC DÙ người đặt hàng thực ra đã có tài khoản và đang
// đăng nhập lúc đó.
//
// NGUYÊN NHÂN GỐC (đã fix ở authController.js + MailClub.jsx): object
// `user` ở client có 2 hình dạng khác nhau tuỳ nguồn — response của
// login()/register() chỉ có field "id", còn response của GET /me chỉ có
// field "_id". Form đăng ký Mail Club đọc `user?._id`, nên nếu khách vừa
// đăng nhập xong (chưa F5 lại trang khiến checkAuth() chạy) rồi đăng ký
// Mail Club ngay thì `user._id` là undefined → gửi `userId: null` lên
// server → Order (và Subscription) bị lưu thành của "khách vãng lai".
// Hệ quả nhìn thấy được: trang Khách hàng ở admin hiện "0 đơn / 0đ chi
// tiêu" dù khách đó đang có gói Mail Club active (vì badge Mail Club khớp
// theo email, không cần userId, nên vẫn hiện đúng — chỉ có thống kê đơn
// hàng/chi tiêu bị "mất tích").
//
// SCRIPT NÀY LÀM GÌ:
// 1. Tìm các Order có user = null NHƯNG có guestEmail trùng khớp (không
//    phân biệt hoa/thường) với email của MỘT User đã tồn tại trong hệ
//    thống → gán lại Order.user = user đó, xoá guestEmail (đã có chủ).
// 2. Tìm các MailClubSubscription có userId = null nhưng email trùng khớp
//    với 1 User đã tồn tại → gán lại userId cho đúng.
//
// AN TOÀN: chỉ ĐỌC trước, in ra danh sách dự kiến thay đổi, và CHỈ ghi vào
// DB khi chạy với cờ --apply. Chạy không cờ = dry-run (xem trước, không
// sửa gì).
//
// Cách chạy (từ thư mục server/):
//   node scripts/backfillOrphanOrderUsers.js            # xem trước (dry-run)
//   node scripts/backfillOrphanOrderUsers.js --apply    # thực sự ghi vào DB
//
// Cần có file .env chứa MONGODB_URI giống lúc chạy server bình thường.

import "dotenv/config";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import MailClubSubscription from "../models/MailClubSubscription.js";
import User from "../models/User.js";

const APPLY = process.argv.includes("--apply");

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Đã kết nối MongoDB");
  console.log(
    APPLY
      ? "⚠️  Chế độ APPLY — sẽ ghi thay đổi thật vào DB.\n"
      : "🔍 Chế độ DRY-RUN — chỉ xem trước, chưa sửa gì. Thêm --apply để ghi thật.\n",
  );

  // Build map email (lowercase) -> user, để tra cứu O(1)
  const users = await User.find().select("_id email").lean();
  const userByEmail = new Map(
    users.map((u) => [u.email.trim().toLowerCase(), u]),
  );

  // ===================== 1. Orders bị "mồ côi" =====================
  const orphanOrders = await Order.find({
    user: null,
    guestEmail: { $ne: "" },
  }).select("_id guestEmail total mailClubSubscription createdAt");

  console.log(
    `🔍 Tìm thấy ${orphanOrders.length} đơn hàng có user=null và có guestEmail`,
  );

  let orderMatched = 0;
  let orderUnmatched = 0;

  for (const order of orphanOrders) {
    const matchedUser = userByEmail.get(
      (order.guestEmail || "").trim().toLowerCase(),
    );

    if (!matchedUser) {
      orderUnmatched++;
      continue; // guestEmail không khớp user nào — đúng là khách vãng lai thật, bỏ qua
    }

    orderMatched++;
    console.log(
      `  ✏️  Order #${order._id.toString().slice(-8)} (${order.guestEmail}, ${order.total.toLocaleString("vi-VN")}đ)` +
        ` → gán user = ${matchedUser._id}`,
    );

    if (APPLY) {
      await Order.updateOne(
        { _id: order._id },
        { $set: { user: matchedUser._id, guestEmail: "" } },
      );
    }
  }

  // ============== 2. MailClubSubscription bị "mồ côi" ==============
  const orphanSubs = await MailClubSubscription.find({
    userId: null,
  }).select("_id email plan status");

  console.log(`\n🔍 Tìm thấy ${orphanSubs.length} subscription có userId=null`);

  let subMatched = 0;
  let subUnmatched = 0;

  for (const sub of orphanSubs) {
    const matchedUser = userByEmail.get((sub.email || "").trim().toLowerCase());

    if (!matchedUser) {
      subUnmatched++;
      continue; // email không khớp User nào — khách đăng ký Mail Club chưa từng tạo tài khoản, bỏ qua
    }

    subMatched++;
    console.log(
      `  ✏️  Subscription ${sub.name || sub.email} (${sub.plan}, ${sub.status}) → gán userId = ${matchedUser._id}`,
    );

    if (APPLY) {
      await MailClubSubscription.updateOne(
        { _id: sub._id },
        { $set: { userId: matchedUser._id } },
      );
    }
  }

  console.log("\n===== TỔNG KẾT =====");
  console.log(
    `Orders:        ${orderMatched} khớp được user${APPLY ? " (đã ghi)" : " (chưa ghi — dry-run)"}, ${orderUnmatched} không khớp (giữ nguyên, là khách vãng lai thật)`,
  );
  console.log(
    `Subscriptions: ${subMatched} khớp được user${APPLY ? " (đã ghi)" : " (chưa ghi — dry-run)"}, ${subUnmatched} không khớp (giữ nguyên)`,
  );
  if (!APPLY && (orderMatched > 0 || subMatched > 0)) {
    console.log(
      "\n👉 Chạy lại với `--apply` để ghi các thay đổi trên vào database thật.",
    );
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Lỗi khi chạy script:", err);
  process.exit(1);
});
