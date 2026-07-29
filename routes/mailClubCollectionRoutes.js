import express from "express";
import {
  getCollections,
  getAllCollections,
  createCollection,
  addImagesToCollection,
  removeImageFromCollection,
  updateCollection,
  deleteCollection,
} from "../controllers/mailClubCollectionController.js";
import { upload } from "../config/cloudinary.js";
import authMiddleware, {
  adminMiddleware,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getCollections); // Public

// Admin only — trước đây thiếu adminMiddleware, cho phép mọi user đã đăng
// nhập tạo/sửa/xoá collection. Đã bổ sung để đồng nhất với các module admin khác.
router.get("/admin", authMiddleware, adminMiddleware, getAllCollections);
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  upload.array("images", 10),
  createCollection,
);
router.post(
  "/:id/images",
  authMiddleware,
  adminMiddleware,
  upload.array("images", 10),
  addImagesToCollection,
);
router.delete(
  "/:id/images",
  authMiddleware,
  adminMiddleware,
  removeImageFromCollection,
);
router.put("/:id", authMiddleware, adminMiddleware, updateCollection);
router.delete("/:id", authMiddleware, adminMiddleware, deleteCollection);

export default router;
