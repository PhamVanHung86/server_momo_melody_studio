import express from "express";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notificationController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getMyNotifications);
router.put("/:id/read", authMiddleware, markNotificationRead);
router.put("/mark-all-read", authMiddleware, markAllNotificationsRead);

export default router;
