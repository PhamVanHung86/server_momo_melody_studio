import rateLimit from "express-rate-limit";

// Áp dụng cho login/register: chống brute-force mật khẩu và spam tạo tài
// khoản ảo. 8 lần/phút/IP là đủ rộng rãi cho người dùng thật (kể cả gõ sai
// mật khẩu vài lần) nhưng chặn được script dò mật khẩu tự động.
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.",
  },
});

// Rộng hơn, áp dụng chung cho toàn bộ API để chặn spam/bot ở mức thô.
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều yêu cầu, vui lòng thử lại sau.",
  },
});

// Chặn spam gửi liên hệ / đăng ký mail club.
export const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Bạn đã gửi quá nhiều lần, vui lòng thử lại sau.",
  },
});
