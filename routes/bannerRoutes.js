import express from "express";
import {
  getActiveBanners,
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} from "../controllers/bannerController.js";
import { upload } from "../config/cloudinary.js";
import authMiddleware, {
  adminMiddleware,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/active", getActiveBanners);
router.get("/", authMiddleware, getAllBanners);

router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  upload.single("image"),
  createBanner,
);
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  upload.single("image"),
  updateBanner,
);
router.delete("/:id", authMiddleware, adminMiddleware, deleteBanner);

export default router;
