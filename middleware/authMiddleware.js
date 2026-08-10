import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { logError } from "../config/logger.js";

const authMiddleware = (req, res, next) => {
  // 🔑 JWT giờ được gửi qua header "Authorization: Bearer <token>"
  // thay vì cookie, để tránh vấn đề cookie cross-domain khi client/admin
  // (Vercel/Netlify) và server (Render/Railway) nằm ở domain khác nhau.
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) return res.status(401).json({ message: "Chưa đăng nhập" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    // 🔑 Phân biệt "hết hạn" (client nên tự gọi /api/auth/refresh rồi thử
    // lại) với "không hợp lệ" (chữ ký sai/token giả — không thể cứu bằng
    // refresh, phải đăng nhập lại). code này được client (apiFetch) đọc để
    // quyết định có tự động refresh hay không.
    const code = err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "TOKEN_INVALID";
    res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn", code });
  }
};

export const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Không có quyền truy cập" });
    }
    next();
  } catch (err) {
    logError(err, { where: "adminMiddleware" });
    res.status(500).json({ message: "Lỗi server" });
  }
};

export default authMiddleware;
