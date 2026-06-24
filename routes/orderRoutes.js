import express from "express";
import {
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  getDashboardStats,
  getAnalytics,
} from "../controllers/orderController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", authMiddleware, createOrder);
router.get("/my-orders", authMiddleware, getMyOrders);
router.get("/", authMiddleware, getAllOrders);
router.put("/:id/status", authMiddleware, updateOrderStatus);
router.get("/dashboard-stats", authMiddleware, getDashboardStats);
router.get("/analytics", authMiddleware, getAnalytics);

export default router;
