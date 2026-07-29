import express from "express";
import {
  getCustomers,
  updateNickname,
  getCustomerDetail,
} from "../controllers/userController.js";
import authMiddleware, {
  adminMiddleware,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, adminMiddleware, getCustomers);
router.get("/:id", authMiddleware, adminMiddleware, getCustomerDetail);
router.put("/:id/nickname", authMiddleware, adminMiddleware, updateNickname);
//router.put("/:id/mail-club", authMiddleware, adminMiddleware);

export default router;
