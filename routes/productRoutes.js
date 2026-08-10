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
import { validate } from "../middleware/validate.js";
import { productSchema } from "../validation/productSchemas.js";

const router = express.Router();

// Public
router.get("/", getProducts);
router.get("/:id", getProductById);

// Admin only
// ⚠️ Thứ tự bắt buộc: upload.array PHẢI chạy trước validate() vì multer là
// nơi duy nhất parse được multipart/form-data thành req.body — validate
// chạy trước sẽ luôn thấy req.body rỗng.
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  upload.array("images", 4),
  validate(productSchema),
  addProduct,
);
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  upload.array("images", 4),
  validate(productSchema),
  updateProduct,
);
router.delete("/:id", authMiddleware, adminMiddleware, deleteProduct);

export default router;
