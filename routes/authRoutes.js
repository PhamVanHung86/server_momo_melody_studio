import express from "express";
import passport from "passport";
import { upload } from "../config/cloudinary.js";
import {
  register,
  login,
  logout,
  refresh,
  getMe,
  updateProfile,
  setPassword,
  issueTokens,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { authLimiter } from "../middleware/rateLimiters.js";
import { validate } from "../middleware/validate.js";
import { registerSchema, loginSchema } from "../validation/authSchemas.js";

const router = express.Router();

// Email + Password (có rate limit chống brute-force/spam)
router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/refresh", authLimiter, refresh);
router.post("/logout", authMiddleware, logout);
router.get("/me", authMiddleware, getMe);
router.put("/profile", authMiddleware, upload.single("avatar"), updateProfile);
router.put("/set-password", authMiddleware, setPassword);

// Google OAuth
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=google`,
  }),
  async (req, res) => {
    // 🔑 Redirect về client kèm cả access + refresh token trong URL. Trang
    // /auth/callback ở client đọc, lưu vào localStorage rồi điều hướng
    // tiếp — token dùng 1 lần rồi được xoá khỏi URL ngay khi xử lý xong.
    const { accessToken, refreshToken } = await issueTokens(req.user);
    res.redirect(
      `${process.env.CLIENT_URL}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`,
    );
  },
);

export default router;
