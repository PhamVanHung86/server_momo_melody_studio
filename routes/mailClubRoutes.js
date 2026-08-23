import express from "express";
import {
  createSubscription,
  getMySubscription,
  getAllSubscriptions,
  confirmPayment,
  renewSubscription,
  triggerNewCycle,
  previewNewCycle,
  confirmNewCycle,
  updateSubscription,
  adminCreateSubscription,
  adminUpdateSubscription,
  sendCustomEmail,
  getMailClubStats,
} from "../controllers/mailClubController.js";
import authMiddleware, {
  adminMiddleware,
} from "../middleware/authMiddleware.js";

import { contactLimiter } from "../middleware/rateLimiters.js";
const router = express.Router();

// Public
router.post("/subscribe", contactLimiter, createSubscription);

// User đã đăng nhập
router.get("/my", authMiddleware, getMySubscription);

// Admin
router.get("/", authMiddleware, adminMiddleware, getAllSubscriptions);
router.get("/stats", authMiddleware, adminMiddleware, getMailClubStats);

router.put("/:id/confirm", authMiddleware, adminMiddleware, confirmPayment);
router.put("/:id/renew", authMiddleware, adminMiddleware, renewSubscription);
router.put("/:id", authMiddleware, adminMiddleware, updateSubscription);
router.post(
  "/send-reminders",
  authMiddleware,
  adminMiddleware,
  triggerNewCycle,
);
// Xem trước nội dung + danh sách người nhận trước khi gửi hàng loạt
router.get(
  "/new-cycle/preview",
  authMiddleware,
  adminMiddleware,
  previewNewCycle,
);
// Admin xác nhận (có thể đã chỉnh sửa nội dung) -> lúc này mới thực sự gửi mail
router.post(
  "/new-cycle/confirm",
  authMiddleware,
  adminMiddleware,
  confirmNewCycle,
);
router.post(
  "/admin/create",
  authMiddleware,
  adminMiddleware,
  adminCreateSubscription,
);
router.post(
  "/send-custom-email",
  authMiddleware,
  adminMiddleware,
  sendCustomEmail,
);
router.put(
  "/admin/:id",
  authMiddleware,
  adminMiddleware,
  adminUpdateSubscription,
);

export default router;
