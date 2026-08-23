// 🌸 Script gửi THỬ email "Mail tháng mới đã có" tới 1 địa chỉ email do bạn
// chỉ định — KHÔNG đụng vào database thật (không trừ lượt, không đổi status
// của bất kỳ subscriber nào). Dùng để xem email thực tế trông ra sao trước
// khi bấm nút "Mở kỳ mới" thật trên admin.
//
// Cách chạy (từ thư mục server/):
//   node scripts/testCycleEmail.js email-cua-ban@gmail.com
//
// Cần có file .env chứa RESEND_API_KEY giống lúc chạy server bình thường.

import "dotenv/config";
import { resend } from "../config/resend.js";

const testEmail = process.argv[2];

if (!testEmail) {
  console.error("❌ Thiếu email nhận thử. Chạy lại:");
  console.error("   node scripts/testCycleEmail.js email-cua-ban@gmail.com");
  process.exit(1);
}

const run = async () => {
  // Dùng tên giả "Khách Test" để xem placeholder ${sub.name} hiện đúng chưa
  const fakeName = "Khách Test";

  const { data, error } = await resend.emails.send({
    from: "momo's melody studio <shop@momomeomeow.com>",
    to: testEmail,
    subject: "🌸 Mail tháng mới đã có — đăng ký để nhận nhé!",
    html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #4A4A6A;">Xin chào  🩵</h2>
          <p style="color: #4A4A6A; line-height: 1.5;">Form đăng ký đang mở, đăng ký lại để tiếp tục nhận mail club mỗi tháng nhé.</p>
          <p style="color: #4A4A6A; line-height: 1.5;">Bạn cũng có thể chuyển khoản theo cú pháp bên dưới để mình gia hạn cho bạn nhé!</p>

          <div style="background: #E8EAF9; padding: 20px; border-radius: 16px; margin: 20px 0;">
            <p style="color: #4A4A6A; margin: 0 0 10px 0;"><strong>Thông tin chuyển khoản:</strong></p>
            <p style="color: #4A4A6A; margin: 4px 0;">Ngân hàng: <strong>TP Bank</strong></p>
            <p style="color: #4A4A6A; margin: 4px 0;">Số tài khoản: <strong>24182951170</strong></p>
            <p style="color: #4A4A6A; margin: 4px 0;">Chủ tài khoản: <strong>TRAN THI NGOC ANH</strong></p>

            <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #CBD1F2;">
              <p style="color: #4A4A6A; margin: 0 0 6px 0; font-size: 13px;">Nội dung chuyển khoản:</p>
              <span style="background: #FF85A2; color: #ffffff; padding: 8px 16px; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 2px 4px rgba(255, 133, 162, 0.35);">
                Tháng mới + Tên + SĐT
              </span>
            </div>
          </div>

          <div style="text-align: center; margin-top: 24px;">
            <a href="https://momomeomeow.netlify.app/"
               target="_blank"
               style="display: inline-block; background-color: #8B98E3; color: #ffffff; padding: 12px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 14px; box-shadow: 0 4px 10px rgba(139, 152, 227, 0.3);">
              🌸 Xem sản phẩm tại đây ->
            </a>
          </div>
        </div>
      `,
  });

  if (error) {
    console.error("❌ Gửi thất bại:", error);
    process.exit(1);
  }

  console.log(`✅ Đã gửi email thử tới ${testEmail}`);
  console.log("   Kiểm tra hộp thư (kể cả mục Spam/Quảng cáo) nhé.");
  process.exit(0);
};

run();
