import FlashSale from "../models/FlashSale.js";

// Lấy flash sale đang active (Public — Client dùng)
export const getActiveFlashSale = async (req, res) => {
  try {
    const now = new Date();
    const flashSale = await FlashSale.findOne({
      active: true,
      startTime: { $lte: now },
      endTime: { $gte: now },
    }).populate("products");

    res.json({ success: true, flashSale });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Lấy tất cả flash sale (Admin)
export const getAllFlashSales = async (req, res) => {
  try {
    const flashSales = await FlashSale.find()
      .populate("products", "name images price")
      .sort({ createdAt: -1 });
    res.json({ success: true, flashSales });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Tạo flash sale mới (Admin)
export const createFlashSale = async (req, res) => {
  try {
    const { title, discountPercent, products, startTime, endTime } = req.body;

    const flashSale = await FlashSale.create({
      title,
      discountPercent,
      products,
      startTime,
      endTime,
    });

    res.status(201).json({ success: true, flashSale });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Sửa flash sale (Admin)
export const updateFlashSale = async (req, res) => {
  try {
    const { id } = req.params;
    const flashSale = await FlashSale.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    res.json({ success: true, flashSale });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Xóa flash sale (Admin)
export const deleteFlashSale = async (req, res) => {
  try {
    await FlashSale.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Đã xóa flash sale" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
