// 🌸 Script vá dữ liệu 1 lần: gán lại `remainingTurns` cho các subscription
// ĐANG ACTIVE đã tồn tại từ TRƯỚC khi field `remainingTurns` được thêm vào
// (những bản ghi đó đang bị mặc định = 0 dù có thể là gói Quý).
//
// CHẠY 1 LẦN DUY NHẤT, ngay sau khi deploy code mới lên, TRƯỚC khi
// processNewCycle() từng chạy lần nào trên dữ liệu thật (an toàn vì lúc đó
// remainingTurns=0 chắc chắn là do "chưa từng được gán", không phải do
// "đã dùng hết lượt thật sự").
//
// Cách chạy (từ thư mục server/):
//   node scripts/backfillRemainingTurns.js
//
// Cần có file .env chứa MONGODB_URI giống lúc chạy server bình thường.

import "dotenv/config";
import mongoose from "mongoose";
import MailClubSubscription from "../models/MailClubSubscription.js";
import { PLAN_EXTRA_TURNS } from "../config/mailClubPricing.js";

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Đã kết nối MongoDB");

  // Chỉ vá các bản ghi ĐANG ACTIVE — pending/expired/cancelled không cần
  // (pending chưa kích hoạt, expired/cancelled không tự động gửi tiếp nữa)
  const activeSubs = await MailClubSubscription.find({ status: "active" });

  console.log(`🔍 Tìm thấy ${activeSubs.length} subscription đang active`);

  let updated = 0;
  let skipped = 0;

  for (const sub of activeSubs) {
    const correctTurns = PLAN_EXTRA_TURNS[sub.plan] ?? 0;

    // Chỉ vá nếu remainingTurns đang là 0 nhưng gói của họ đáng lẽ phải > 0
    // (VD gói Quý=2). Nếu remainingTurns đã > 0 rồi (VD đã được gán đúng lúc
    // đăng ký mới sau khi deploy code mới) thì KHÔNG động vào, tránh ghi đè
    // nhầm lên dữ liệu đã đúng.
    if (sub.remainingTurns === 0 && correctTurns > 0) {
      sub.remainingTurns = correctTurns;
      await sub.save();
      updated++;
      console.log(
        `  ✏️  ${sub.name} (${sub.email}) — gói ${sub.plan} — gán remainingTurns = ${correctTurns}`,
      );
    } else {
      skipped++;
    }
  }

  console.log(
    `\n✅ Hoàn tất: đã vá ${updated} bản ghi, bỏ qua ${skipped} bản ghi (đã đúng hoặc gói Tháng).`,
  );
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Lỗi khi chạy script:", err);
  process.exit(1);
});
