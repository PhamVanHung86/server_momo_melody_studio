// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import cron from "node-cron";
// import helmet from "helmet";
// import compression from "compression";

// // 🔑 Load biến môi trường ngay ở đầu file trước khi import DB/Routes
// dotenv.config();

// import { validateEnv } from "./config/validateEnv.js";
// validateEnv();

// import { globalLimiter } from "./middleware/rateLimiters.js";
// import { logInfo, logError } from "./config/logger.js";
// import passport from "./config/passport.js";
// import connectDB from "./config/db.js";
// import authRoutes from "./routes/authRoutes.js";
// import productRoutes from "./routes/productRoutes.js";
// import orderRoutes from "./routes/orderRoutes.js";
// import userRoutes from "./routes/userRoutes.js";
// import flashSaleRoutes from "./routes/flashSaleRoutes.js";
// import bannerRoutes from "./routes/bannerRoutes.js";
// import contactRoutes from "./routes/contactRoutes.js";
// import mailClubRoutes from "./routes/mailClubRoutes.js";
// import mailClubCollectionRoutes from "./routes/mailClubCollectionRoutes.js";
// import mailClubSettingsRoutes from "./routes/mailClubSettingsRoutes.js";
// import notificationRoutes from "./routes/notificationRoutes.js";
// import wishlistRoutes from "./routes/wishlistRoutes.js";
// import reviewRoutes from "./routes/reviewRoutes.js";
// import sitemapRoutes from "./routes/sitemapRoutes.js";
// import { autoExpireSubscriptions } from "./controllers/mailClubController.js";

// connectDB();

// // 🌐 Lấy danh sách URL từ .env (Có kèm giá trị mặc định fallback phòng khi quên cài .env)
// const allowedOrigins = [
//   process.env.CLIENT_URL || "http://localhost:5173",
//   process.env.ADMIN_URL || "http://localhost:5174",
// ].filter(Boolean); // Lọc bỏ các giá trị undefined nếu có

// const app = express();
// app.set("trust proxy", 1);

// // 🛒 Cấu hình CORS dùng biến môi trường
// app.use(
//   cors({
//     origin: allowedOrigins,
//     credentials: true,
//   }),
// );

// app.use(express.json());
// // 🛡️ Helmet: thêm các HTTP header bảo mật cơ bản (chống clickjacking,
// // MIME-sniffing...). crossOriginResourcePolicy tắt để không chặn ảnh
// // Cloudinary/API được load từ domain khác (client/admin).
// app.use(
//   helmet({
//     crossOriginResourcePolicy: { policy: "cross-origin" },
//   }),
// );
// // 📦 Nén response (gzip) — giảm dung lượng JSON trả về, đặc biệt hữu ích
// // với danh sách sản phẩm dài.
// app.use(compression());
// // 🚦 Giới hạn tốc độ gọi API ở mức thô cho toàn bộ app (chặn bot/spam cơ bản)
// app.use(globalLimiter);
// app.use(passport.initialize());

// // 🕐 Cronjob chạy tự động kiểm tra hết hạn Mail Club
// cron.schedule("1 0 * * *", () => {
//   console.log("🕐 Running auto expire subscriptions...");
//   autoExpireSubscriptions();
// });

// // 📌 Routes API
// app.use("/api/auth", authRoutes);
// app.use("/api/products", productRoutes);
// app.use("/api/orders", orderRoutes);
// app.use("/api/users", userRoutes);
// app.use("/api/flash-sales", flashSaleRoutes);
// app.use("/api/banners", bannerRoutes);
// app.use("/api/contact", contactRoutes);
// app.use("/api/mail-club", mailClubRoutes);
// app.use("/api/mail-club-collections", mailClubCollectionRoutes);
// app.use("/api/mail-club-settings", mailClubSettingsRoutes);
// app.use("/api/notifications", notificationRoutes);
// app.use("/api/wishlist", wishlistRoutes);
// app.use("/api/reviews", reviewRoutes);
// app.use("/", sitemapRoutes); // /sitemap.xml — cần ở root, không prefix /api

// app.get("/", (req, res) => res.send("momo's melody studio API 🌸"));

// // ==========================================
// // 1. 🛑 404 HANDLER: Chạy khi người dùng gọi sai URL không tồn tại
// // ==========================================
// app.use((req, res, next) => {
//   const error = new Error(`Không tìm thấy đường dẫn: ${req.originalUrl}`);
//   res.status(404);
//   next(error); // Chuyển lỗi này xuống Global Error Handler bên dưới
// });

// // ==========================================
// // 2. 🚨 GLOBAL ERROR HANDLER: Nơi hứng TOÀN BỘ lỗi của ứng dụng
// // ==========================================
// app.use((err, req, res, next) => {
//   // Nếu status code trước đó chưa set lỗi thì mặc định lấy 500
//   const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

//   logError(err, { path: req.originalUrl, method: req.method });

//   res.status(statusCode).json({
//     success: false,
//     message: err.message || "Lỗi máy chủ nội bộ",
//     // 💡 Hiện vết lỗi (stack trace) để debug khi dev, ẩn đi khi đưa lên server thương mại
//     stack: process.env.NODE_ENV === "development" ? err.stack : null,
//   });
// });

// const PORT = process.env.PORT || 4000;
// app.listen(PORT, () => logInfo(`Server running on port ${PORT}`));

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cron from "node-cron";
import helmet from "helmet";
import compression from "compression";

// 🔑 Load biến môi trường ngay ở đầu file trước khi import DB/Routes
dotenv.config();

import { validateEnv } from "./config/validateEnv.js";
validateEnv();

import { globalLimiter } from "./middleware/rateLimiters.js";
import { logInfo, logError } from "./config/logger.js";
import passport from "./config/passport.js";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import flashSaleRoutes from "./routes/flashSaleRoutes.js";
import bannerRoutes from "./routes/bannerRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import mailClubRoutes from "./routes/mailClubRoutes.js";
import mailClubCollectionRoutes from "./routes/mailClubCollectionRoutes.js";
import mailClubSettingsRoutes from "./routes/mailClubSettingsRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import sitemapRoutes from "./routes/sitemapRoutes.js";
import { autoExpireSubscriptions } from "./controllers/mailClubController.js";

connectDB();

// 🌐 Lấy danh sách URL từ .env (Có kèm giá trị mặc định fallback phòng khi quên cài .env)
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:5173",
  process.env.ADMIN_URL || "http://localhost:5174",
].filter(Boolean); // Lọc bỏ các giá trị undefined nếu có

// 🔍 In ra ngay lúc server start để dễ đối chiếu với domain Netlify thật
// trong log deploy — tránh phải đoán mò khi gặp lỗi CORS ở production.
console.log("🌐 CORS allowedOrigins:", allowedOrigins);

const app = express();
app.set("trust proxy", 1);

// 🛒 Cấu hình CORS dùng biến môi trường
// Dùng function thay vì mảng tĩnh để có thể LOG RÕ mỗi khi một origin bị
// chặn — nếu không sẽ chỉ thấy lỗi CORS mơ hồ ở phía trình duyệt, còn
// server thì im lặng hoàn toàn (rất khó debug ở production).
app.use(
  cors({
    origin: (origin, callback) => {
      // Request không có Origin header (Postman, curl, server-to-server...)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(
        `🚫 CORS chặn origin lạ: "${origin}" — không nằm trong allowedOrigins:`,
        allowedOrigins,
      );
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json());
// 🛡️ Helmet: thêm các HTTP header bảo mật cơ bản (chống clickjacking,
// MIME-sniffing...). crossOriginResourcePolicy tắt để không chặn ảnh
// Cloudinary/API được load từ domain khác (client/admin).
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
// 📦 Nén response (gzip) — giảm dung lượng JSON trả về, đặc biệt hữu ích
// với danh sách sản phẩm dài.
app.use(compression());
// 🚦 Giới hạn tốc độ gọi API ở mức thô cho toàn bộ app (chặn bot/spam cơ bản)
app.use(globalLimiter);
app.use(passport.initialize());

// 🕐 Cronjob chạy tự động kiểm tra hết hạn Mail Club
cron.schedule("1 0 * * *", () => {
  console.log("🕐 Running auto expire subscriptions...");
  autoExpireSubscriptions();
});

// 📌 Routes API
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);
app.use("/api/flash-sales", flashSaleRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/mail-club", mailClubRoutes);
app.use("/api/mail-club-collections", mailClubCollectionRoutes);
app.use("/api/mail-club-settings", mailClubSettingsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/", sitemapRoutes); // /sitemap.xml — cần ở root, không prefix /api

app.get("/", (req, res) => res.send("momo's melody studio API 🌸"));

// ⚠️ CHỈ ĐỂ TEST LOCAL — XOÁ SAU KHI TEST XONG
// app.get("/", async (req, res) => {
//   await new Promise((r) => setTimeout(r, 20000)); // giả lập cold start 20s
//   res.send("momo's melody studio API 🌸");
// });

// ==========================================
// 1. 🛑 404 HANDLER: Chạy khi người dùng gọi sai URL không tồn tại
// ==========================================
app.use((req, res, next) => {
  const error = new Error(`Không tìm thấy đường dẫn: ${req.originalUrl}`);
  res.status(404);
  next(error); // Chuyển lỗi này xuống Global Error Handler bên dưới
});

// ==========================================
// 2. 🚨 GLOBAL ERROR HANDLER: Nơi hứng TOÀN BỘ lỗi của ứng dụng
// ==========================================
app.use((err, req, res, next) => {
  // Nếu status code trước đó chưa set lỗi thì mặc định lấy 500
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  logError(err, { path: req.originalUrl, method: req.method });

  res.status(statusCode).json({
    success: false,
    message: err.message || "Lỗi máy chủ nội bộ",
    // 💡 Hiện vết lỗi (stack trace) để debug khi dev, ẩn đi khi đưa lên server thương mại
    stack: process.env.NODE_ENV === "development" ? err.stack : null,
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => logInfo(`Server running on port ${PORT}`));
