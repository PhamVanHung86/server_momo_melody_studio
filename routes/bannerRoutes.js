import express from "express";
import {
  getActiveBanners,
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} from "../controllers/bannerController.js";
import { upload } from "../config/cloudinary.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/active", getActiveBanners);
router.get("/", authMiddleware, getAllBanners);
router.post("/", authMiddleware, upload.single("image"), createBanner);
router.put("/:id", authMiddleware, upload.single("image"), updateBanner);
router.delete("/:id", authMiddleware, deleteBanner);

export default router;
