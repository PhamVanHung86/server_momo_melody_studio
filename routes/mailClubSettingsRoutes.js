import express from "express";
import {
  getSettings,
  updateSettings,
} from "../controllers/mailClubSettingsController.js";
import authMiddleware, {
  adminMiddleware,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getSettings);
router.put("/", authMiddleware, adminMiddleware, updateSettings);

export default router;
