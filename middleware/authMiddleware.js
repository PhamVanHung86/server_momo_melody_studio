import jwt from "jsonwebtoken";
import User from "../models/User.js";

const authMiddleware = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Chưa đăng nhập" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Token không hợp lệ" });
  }
};

export const adminMiddleware = async (req, res, next) => {
  try {
    console.log("Checking admin for user:", req.user.id); // ← debug
    const user = await User.findById(req.user.id);
    console.log("User role:", user?.role); // ← debug
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Không có quyền truy cập" });
    }
    next();
  } catch (err) {
    console.error("adminMiddleware error:", err); // ← debug
    res.status(500).json({ message: "Lỗi server" });
  }
};

export default authMiddleware;
