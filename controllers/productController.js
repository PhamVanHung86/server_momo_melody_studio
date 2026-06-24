import Product from "../models/Product.js";
import cloudinary from "../config/cloudinary.js";

// Lấy tất cả sản phẩm
export const getProducts = async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = {};

    if (category) query.category = category;
    if (search) query.name = { $regex: search, $options: "i" };

    const products = await Product.find(query).sort({ date: -1 });
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Thêm sản phẩm mới
export const addProduct = async (req, res) => {
  try {
    const { name, description, price, category, bestseller, stock } = req.body;

    // Lấy URL ảnh từ Cloudinary
    const images = req.files.map((file) => file.path);

    const product = await Product.create({
      name,
      description,
      price: Number(price),
      category,
      bestseller: bestseller === "true",
      stock: Number(stock) || 0,
      images,
    });

    res.status(201).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cập nhật sản phẩm
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, category, bestseller, stock } = req.body;

    const updateData = {
      name,
      description,
      price: Number(price),
      category,
      bestseller: bestseller === "true",
      stock: Number(stock) || 0,
    };

    // Nếu có ảnh mới thì cập nhật
    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map((file) => file.path);
    }

    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Xóa sản phẩm
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product)
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

    // Xóa ảnh trên Cloudinary
    for (const imageUrl of product.images) {
      const publicId = imageUrl.split("/").slice(-2).join("/").split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    }

    await product.deleteOne();
    res.json({ success: true, message: "Xóa sản phẩm thành công" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Lấy sản phảm theo ID
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
