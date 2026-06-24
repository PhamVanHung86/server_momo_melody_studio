import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getCustomers,
  updateNickname,
  getCustomerDetail,
} from "../controllers/userController.js";

const router = express.Router();

router.get("/", authMiddleware, getCustomers);
router.get("/:id", authMiddleware, getCustomerDetail);
router.put("/:id/nickname", authMiddleware, updateNickname);

export default router;
