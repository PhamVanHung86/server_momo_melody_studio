import Banner from "../models/Banner.js";
import cloudinary from "../config/cloudinary.js";

export const getActiveBanners = async (req, res) => {
  try {
    const banners = await Banner.find({ active: true }).sort({
      order: 1,
      createdAt: -1,
    });
    res.json({ success: true, banners });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ order: 1, createdAt: -1 });
    res.json({ success: true, banners });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createBanner = async (req, res) => {
  try {
    const { title, description, launchDate, linkTo, badge, order } = req.body;
    const image = req.file?.path;

    if (!image) return res.status(400).json({ message: "Vui lòng thêm ảnh" });

    const banner = await Banner.create({
      title,
      description,
      image,
      launchDate,
      linkTo,
      badge,
      order: Number(order) || 0,
    });

    res.status(201).json({ success: true, banner });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    if (req.file) updateData.image = req.file.path;

    const banner = await Banner.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    res.json({ success: true, banner });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (banner?.image) {
      const publicId = banner.image
        .split("/")
        .slice(-2)
        .join("/")
        .split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    }
    await Banner.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Đã xóa banner" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
