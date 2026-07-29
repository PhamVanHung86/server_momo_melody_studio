import express from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import { upload } from "../config/cloudinary.js";
import {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  setPassword,
  setCookie,
  generateToken,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Email + Password
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
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
    failureRedirect: "http://localhost:5173/login?error=google",
  }),
  (req, res) => {
    const token = generateToken(req.user._id);
    setCookie(res, token);

    res.redirect("http://localhost:5173");
  },
);

export default router;
