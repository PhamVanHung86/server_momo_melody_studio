// Kiểm tra các biến môi trường BẮT BUỘC ngay khi server khởi động.
//
// Lý do thêm file này: trước đây thiếu SERVER_URL khiến Google OAuth lỗi
// "redirect_uri_mismatch" một cách khó hiểu — server vẫn chạy bình thường,
// lỗi chỉ lộ ra khi user bấm đăng nhập Google. Nếu check ngay lúc start,
// lỗi sẽ hiện ra NGAY LẬP TỨC trong log deploy, dễ phát hiện hơn nhiều so
// với đợi user report.
const REQUIRED_ENV_VARS = [
  "MONGODB_URI",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "SERVER_URL",
  "CLIENT_URL",
  "ADMIN_URL",
  "ADMIN_EMAIL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "RESEND_API_KEY",
];

export function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("❌ Thiếu biến môi trường bắt buộc trong .env:");
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error(
      "\nXem file .env.example để biết đầy đủ danh sách biến cần thiết.",
    );
    process.exit(1); // Dừng server ngay, không để chạy ngầm với config thiếu
  }

  console.log("✅ Biến môi trường hợp lệ.");
}

export default validateEnv;
