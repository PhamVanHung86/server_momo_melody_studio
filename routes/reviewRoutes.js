import express from "express";
import {
  getProductReviews,
  upsertReview,
  deleteReview,
} from "../controllers/reviewController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Public — ai cũng xem được review
router.get("/product/:productId", getProductReviews);

// Cần đăng nhập
router.put("/product/:productId", authMiddleware, upsertReview);
router.delete("/:id", authMiddleware, deleteReview);

export default router;
