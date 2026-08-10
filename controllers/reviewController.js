import Review from "../models/Review.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import User from "../models/User.js";

// Tính lại rating trung bình + số lượng review, lưu cache vào Product để
// hiển thị nhanh (không phải aggregate lại mỗi lần load trang sản phẩm).
async function recalcProductRating(productId) {
  const stats = await Review.aggregate([
    { $match: { product: productId } },
    {
      $group: {
        _id: "$product",
        avg: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  const { avg = 0, count = 0 } = stats[0] || {};
  await Product.findByIdAndUpdate(productId, {
    ratingAvg: Math.round(avg * 10) / 10, // làm tròn 1 chữ số thập phân
    ratingCount: count,
  });
}

// Lấy toàn bộ review của 1 sản phẩm (mới nhất trước)
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({ product: productId })
      .populate("user", "name avatar")
      .sort({ createdAt: -1 });
    res.json({ success: true, reviews });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Thêm hoặc cập nhật review của chính mình cho 1 sản phẩm (upsert — gọi
// lại API này để sửa review cũ thay vì tạo review trùng, đã chặn ở DB bằng
// unique index nhưng xử lý ở đây cho trải nghiệm mượt, không báo lỗi).
// Chỉ cho phép review nếu user đã từng mua sản phẩm này ("verified
// purchase") — tránh review ảo/spam từ người chưa từng mua.
export const upsertReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;

    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return res
        .status(400)
        .json({ message: "Vui lòng chọn số sao từ 1 đến 5" });
    }

    const hasPurchased = await Order.exists({
      user: req.user.id,
      "items.product": productId,
      status: { $ne: "Đã hủy" },
    });
    if (!hasPurchased) {
      return res.status(403).json({
        message: "Bạn cần mua sản phẩm này trước khi đánh giá",
      });
    }

    const review = await Review.findOneAndUpdate(
      { product: productId, user: req.user.id },
      { rating: ratingNum, comment: comment?.trim() || "" },
      { new: true, upsert: true, runValidators: true },
    );

    await recalcProductRating(review.product);

    res.json({ success: true, review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Xoá review — chỉ chủ review hoặc admin
export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review)
      return res.status(404).json({ message: "Không tìm thấy đánh giá" });

    const isOwner = review.user.toString() === req.user.id;
    if (!isOwner) {
      const currentUser = await User.findById(req.user.id).select("role");
      if (currentUser?.role !== "admin") {
        return res
          .status(403)
          .json({ message: "Không có quyền xoá đánh giá này" });
      }
    }

    const productId = review.product;
    await review.deleteOne();
    await recalcProductRating(productId);

    res.json({ success: true, message: "Đã xoá đánh giá" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
