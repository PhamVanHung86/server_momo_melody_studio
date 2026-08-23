import express from "express";
import {
  createContactMessage,
  getAllMessages,
  markAsRead,
  deleteMessage,
} from "../controllers/contactController.js";
import authMiddleware, {
  adminMiddleware,
} from "../middleware/authMiddleware.js";
import { contactLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

router.post("/", contactLimiter, createContactMessage); // Public — ai cũng gửi được
router.get("/", authMiddleware, adminMiddleware, getAllMessages);
router.put("/:id/read", authMiddleware, adminMiddleware, markAsRead);
router.delete("/:id", authMiddleware, adminMiddleware, deleteMessage);

export default router;
