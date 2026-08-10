import User from "../models/User.js";
import Product from "../models/Product.js";

// Lấy danh sách sản phẩm yêu thích của user hiện tại (đã populate đầy đủ
// thông tin sản phẩm để hiển thị luôn, không cần gọi thêm API).
export const getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("wishlist");
    if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

    // Lọc bỏ sản phẩm đã bị xoá khỏi hệ thống (populate trả về null)
    const products = (user.wishlist || []).filter(Boolean);
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Thêm/bỏ 1 sản phẩm khỏi wishlist (toggle) — client chỉ cần gọi 1 endpoint
// duy nhất thay vì phải tự biết trạng thái hiện tại rồi gọi add/remove riêng.
export const toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId).select("_id");
    if (!product)
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

    const idx = user.wishlist.findIndex((id) => id.toString() === productId);
    let inWishlist;
    if (idx > -1) {
      user.wishlist.splice(idx, 1);
      inWishlist = false;
    } else {
      user.wishlist.push(productId);
      inWishlist = true;
    }
    await user.save();

    res.json({ success: true, inWishlist });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
