import express from "express";
import {
  createSubscription,
  getMySubscription,
  getAllSubscriptions,
  confirmPayment,
  renewSubscription,
  sendRenewalReminders,
  updateSubscription,
  adminCreateSubscription,
  adminUpdateSubscription,
} from "../controllers/mailClubController.js";
import authMiddleware, {
  adminMiddleware,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Public
router.post("/subscribe", createSubscription);

// User đã đăng nhập
router.get("/my", authMiddleware, getMySubscription);

// Admin
router.get("/", authMiddleware, adminMiddleware, getAllSubscriptions);
router.put("/:id/confirm", authMiddleware, adminMiddleware, confirmPayment);
router.put("/:id/renew", authMiddleware, adminMiddleware, renewSubscription);
router.put("/:id", authMiddleware, adminMiddleware, updateSubscription);
router.post(
  "/send-reminders",
  authMiddleware,
  adminMiddleware,
  sendRenewalReminders,
);
router.post(
  "/admin/create",
  authMiddleware,
  adminMiddleware,
  adminCreateSubscription,
);
router.put(
  "/admin/:id",
  authMiddleware,
  adminMiddleware,
  adminUpdateSubscription,
);

export default router;
