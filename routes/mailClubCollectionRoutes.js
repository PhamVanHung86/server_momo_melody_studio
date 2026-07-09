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
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getCollections); // Public
router.get("/admin", authMiddleware, getAllCollections);
router.post("/", authMiddleware, upload.array("images", 10), createCollection);
router.post(
  "/:id/images",
  authMiddleware,
  upload.array("images", 10),
  addImagesToCollection,
);
router.delete("/:id/images", authMiddleware, removeImageFromCollection);
router.put("/:id", authMiddleware, updateCollection);
router.delete("/:id", authMiddleware, deleteCollection);

export default router;
