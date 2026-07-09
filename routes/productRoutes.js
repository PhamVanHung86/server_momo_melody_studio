import express from "express";
import {
  getProducts,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import { upload } from "../config/cloudinary.js";
import authMiddleware, {
  adminMiddleware,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Public
router.get("/", getProducts);
router.get("/:id", getProductById);

// Admin only
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  upload.array("images", 4),
  addProduct,
);
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  upload.array("images", 4),
  updateProduct,
);
router.delete("/:id", authMiddleware, adminMiddleware, deleteProduct);

export default router;
