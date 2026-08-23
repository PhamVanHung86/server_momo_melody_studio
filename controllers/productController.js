import Product from "../models/Product.js";
import cloudinary from "../config/cloudinary.js";
import { escapeRegex } from "../utils/escapeRegex.js";

// Lấy danh sách sản phẩm — hỗ trợ lọc theo category/khoảng giá, tìm kiếm,
// sắp xếp, và PHÂN TRANG (tuỳ chọn qua ?page=&limit=). Nếu không truyền
// page/limit thì giữ hành vi cũ: trả về toàn bộ sản phẩm khớp điều kiện
// (không breaking change với các chỗ đang gọi API cũ, VD: admin panel).
export const getProducts = async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, sort, page, limit } =
      req.query;
    let query = {};

    if (category) query.category = category;
    if (search) {
      query.name = { $regex: escapeRegex(search), $options: "i" };
    }
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    const sortMap = {
      "price-asc": { price: 1 },
      "price-desc": { price: -1 },
      bestseller: { sold: -1 },
      newest: { date: -1 },
    };
    const sortOption = sortMap[sort] || { date: -1 };

    // Không truyền page → giữ hành vi cũ (trả hết, không phân trang)
    if (!page) {
      const products = await Product.find(query).sort(sortOption);
      return res.json({ success: true, products });
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort(sortOption)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Product.countDocuments(query),
    ]);

    res.json({
      success: true,
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Thêm sản phẩm mới
export const addProduct = async (req, res) => {
  try {
    const { name, description, price, category, bestseller, stock } = req.body;

    // 🛑 1. Kiểm tra xem có file ảnh nào được gửi lên hay không
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn ít nhất 1 hình ảnh cho sản phẩm",
      });
    }

    // 📸 2. Lấy danh sách URL ảnh từ Cloudinary (an toàn vì req.files chắc chắn tồn tại)
    const images = req.files.map((file) => file.path);

    // 📦 3. Tạo sản phẩm mới — req.body đã được validate(productSchema) ép
    // kiểu đúng (price/stock là number, bestseller là boolean thật)
    const product = await Product.create({
      name,
      description,
      price,
      category,
      bestseller,
      stock,
      images,
    });

    res.status(201).json({ success: true, product });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Không thể thêm sản phẩm" });
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
      price,
      category,
      bestseller,
      stock,
    };

    let oldImages = [];
    if (req.files && req.files.length > 0) {
      const existingProduct = await Product.findById(id).select("images");
      oldImages = existingProduct?.images || [];
      updateData.images = req.files.map((file) => file.path);
    }

    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    // Xoá ảnh cũ trên Cloudinary sau khi update DB thành công, tránh rác tài nguyên
    if (oldImages.length > 0) {
      for (const imageUrl of oldImages) {
        try {
          const publicId = imageUrl
            .split("/")
            .slice(-2)
            .join("/")
            .split(".")[0];
          await cloudinary.uploader.destroy(publicId);
        } catch (destroyErr) {
          console.error("Lỗi xoá ảnh cũ trên Cloudinary:", destroyErr);
        }
      }
    }

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
