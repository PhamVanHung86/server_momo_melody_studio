import express from "express";
import {
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  getDashboardStats,
  getAnalytics,
} from "../controllers/orderController.js";
import authMiddleware, {
  adminMiddleware,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/dashboard-stats",
  authMiddleware,
  adminMiddleware,
  getDashboardStats,
);
router.get("/analytics", authMiddleware, adminMiddleware, getAnalytics);
router.get("/", authMiddleware, adminMiddleware, getAllOrders);
router.put("/:id/status", authMiddleware, adminMiddleware, updateOrderStatus);
// Giữ nguyên routes của user:
router.post("/", authMiddleware, createOrder);
router.get("/my-orders", authMiddleware, getMyOrders);

export default router;
