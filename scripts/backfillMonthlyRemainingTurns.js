// 🌸 Script vá dữ liệu 1 lần: gán remainingTurns = 0 (tường minh) cho các
// subscription ĐANG ACTIVE, gói THÁNG, mà field `remainingTurns` đang bị
// THIẾU trong MongoDB (tạo từ trước khi field này tồn tại).
//
// Vì sao cần: backfillRemainingTurns.js (script cũ) chỉ vá gói Quý, bỏ qua
// gói Tháng vì nghĩ "0 là đúng rồi" — nhưng thực ra field đó chưa từng được
// GHI vào DB, nên khi API dùng .lean() để đọc, nó trả về `undefined` thay vì
// `0`. Hậu quả: những subscriber này không được nhận diện là "sắp hết hạn"
// dù thực chất đã dùng hết lượt, vì so sánh `undefined === 0` luôn false.
//
// Cách chạy (từ thư mục server/):
//   node scripts/backfillMonthlyRemainingTurns.js
//
// Cần có file .env chứa MONGODB_URI giống lúc chạy server bình thường.
// AN TOÀN để chạy nhiều lần (idempotent) — chỉ update các bản ghi thực sự
// thiếu field, dùng $exists: false nên không đụng vào bản ghi đã có giá trị
// (kể cả giá trị 0 "thật" đã dùng hết lượt, hay giá trị dương còn lượt).

import "dotenv/config";
import mongoose from "mongoose";
import MailClubSubscription from "../models/MailClubSubscription.js";

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Đã kết nối MongoDB");

  const result = await MailClubSubscription.updateMany(
    {
      status: "active",
      plan: "monthly",
      remainingTurns: { $exists: false },
    },
    { $set: { remainingTurns: 0 } },
  );

  console.log(
    `✅ Hoàn tất: đã vá ${result.modifiedCount} bản ghi (gói Tháng, thiếu field remainingTurns).`,
  );

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Lỗi khi chạy script:", err);
  process.exit(1);
});
