// Logger tập trung. Hiện tại chỉ in ra console (đủ dùng với log của
// Render/Railway — họ tự thu thập stdout/stderr), nhưng gom về một chỗ để
// sau này dễ tích hợp Sentry hoặc dịch vụ log khác mà không phải sửa từng
// chỗ gọi console.log/console.error rải rác khắp code.
//
// Cách bật Sentry sau này (khi có DSN thật):
//   npm install @sentry/node
//   import * as Sentry from "@sentry/node";
//   if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN });
//   → trong logError, thêm: if (process.env.SENTRY_DSN) Sentry.captureException(error);
const isProd = process.env.NODE_ENV === "production";

export const logInfo = (...args) => {
  console.log(`[INFO] ${new Date().toISOString()}`, ...args);
};

export const logWarn = (...args) => {
  console.warn(`[WARN] ${new Date().toISOString()}`, ...args);
};

export const logError = (error, context = {}) => {
  console.error(`[ERROR] ${new Date().toISOString()}`, {
    message: error?.message || error,
    stack: !isProd ? error?.stack : undefined,
    ...context,
  });

  // 🔌 Hook sẵn cho Sentry — chỉ cần bỏ comment khi có SENTRY_DSN thật:
  // if (process.env.SENTRY_DSN) Sentry.captureException(error);
};

export default { logInfo, logWarn, logError };
