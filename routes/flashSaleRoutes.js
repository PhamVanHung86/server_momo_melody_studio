import express from "express";
import {
  getActiveFlashSale,
  getAllFlashSales,
  createFlashSale,
  updateFlashSale,
  deleteFlashSale,
} from "../controllers/flashSaleController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/active", getActiveFlashSale); // Public
router.get("/", authMiddleware, getAllFlashSales);
router.post("/", authMiddleware, createFlashSale);
router.put("/:id", authMiddleware, updateFlashSale);
router.delete("/:id", authMiddleware, deleteFlashSale);

export default router;
