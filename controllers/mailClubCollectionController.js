import MailClubCollection from "../models/MailClubCollection.js";
import cloudinary from "../config/cloudinary.js";
import { upload } from "../config/cloudinary.js";

// Public — Client xem
export const getCollections = async (req, res) => {
  try {
    const collections = await MailClubCollection.find({ active: true }).sort({
      year: -1,
      month: -1,
    });
    res.json({ success: true, collections });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin — Lấy tất cả
export const getAllCollections = async (req, res) => {
  try {
    const collections = await MailClubCollection.find().sort({
      year: -1,
      month: -1,
    });
    res.json({ success: true, collections });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin — Tạo mới
export const createCollection = async (req, res) => {
  try {
    const { title, month, year, description } = req.body;
    const images = req.files?.map((f) => f.path) || [];

    const collection = await MailClubCollection.create({
      title,
      month: Number(month),
      year: Number(year),
      description,
      images,
    });

    res.status(201).json({ success: true, collection });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin — Thêm ảnh vào collection đã có
export const addImagesToCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const newImages = req.files?.map((f) => f.path) || [];

    const collection = await MailClubCollection.findByIdAndUpdate(
      id,
      { $push: { images: { $each: newImages } } },
      { returnDocument: "after" },
    );

    res.json({ success: true, collection });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin — Xóa ảnh khỏi collection
export const removeImageFromCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const { imageUrl } = req.body;

    const publicId = imageUrl.split("/").slice(-2).join("/").split(".")[0];
    await cloudinary.uploader.destroy(publicId);

    const collection = await MailClubCollection.findByIdAndUpdate(
      id,
      { $pull: { images: imageUrl } },
      { returnDocument: "after" },
    );

    res.json({ success: true, collection });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin — Cập nhật info
export const updateCollection = async (req, res) => {
  try {
    const collection = await MailClubCollection.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: "after" },
    );
    res.json({ success: true, collection });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin — Xóa collection
export const deleteCollection = async (req, res) => {
  try {
    const collection = await MailClubCollection.findById(req.params.id);
    if (collection) {
      for (const img of collection.images) {
        const publicId = img.split("/").slice(-2).join("/").split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      }
      await collection.deleteOne();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
