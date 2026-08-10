import express from "express";
import { getWishlist, toggleWishlist } from "../controllers/wishlistController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Toàn bộ route wishlist đều cần đăng nhập
router.get("/", authMiddleware, getWishlist);
router.post("/:productId/toggle", authMiddleware, toggleWishlist);

export default router;
