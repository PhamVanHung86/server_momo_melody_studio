import express from "express";
import {
  getActiveFlashSale,
  getAllFlashSales,
  createFlashSale,
  updateFlashSale,
  deleteFlashSale,
} from "../controllers/flashSaleController.js";
import authMiddleware, {
  adminMiddleware,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/active", getActiveFlashSale); // Public
router.get("/", authMiddleware, adminMiddleware, getAllFlashSales);
router.post("/", authMiddleware, adminMiddleware, createFlashSale);
router.put("/:id", authMiddleware, adminMiddleware, updateFlashSale);
router.delete("/:id", authMiddleware, adminMiddleware, deleteFlashSale);

export default router;
