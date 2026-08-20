import express from "express";
import {
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  confirmOrder,
  getPendingOrdersCount,
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
router.get(
  "/pending-count",
  authMiddleware,
  adminMiddleware,
  getPendingOrdersCount,
);
router.get("/", authMiddleware, adminMiddleware, getAllOrders);
router.put("/:id/status", authMiddleware, adminMiddleware, updateOrderStatus);
router.put("/:id/confirm", authMiddleware, adminMiddleware, confirmOrder);
// Giữ nguyên routes của user:
router.post("/", authMiddleware, createOrder);
router.get("/my-orders", authMiddleware, getMyOrders);

export default router;
