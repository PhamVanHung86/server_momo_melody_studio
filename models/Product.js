import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true },
    images: [{ type: String }],
    bestseller: { type: Boolean, default: false },
    stock: { type: Number, default: 0, min: 0 },
    sold: { type: Number, default: 0, min: 0 },
    date: { type: Date, default: Date.now },
    // ⭐ Đánh giá — cache lại giá trị trung bình + số lượng để hiển thị
    // nhanh (không phải aggregate lại toàn bộ review mỗi lần load trang),
    // được cập nhật mỗi khi có review mới/bị xoá (xem reviewController.js)
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// 📈 Index tăng tốc các truy vấn phổ biến nhất:
// - category: lọc theo danh mục (rất thường xuyên ở trang Collection)
// - text index (name + description): tìm kiếm nhanh hơn nhiều so với
//   $regex quét toàn bộ collection, đồng thời hỗ trợ sắp xếp theo độ liên
//   quan nếu sau này muốn nâng cấp search
// - price, date, sold: các trường dùng để sort (giá tăng/giảm, mới nhất,
//   bán chạy nhất)
productSchema.index({ category: 1 });
productSchema.index({ name: "text", description: "text" });
productSchema.index({ price: 1 });
productSchema.index({ date: -1 });
productSchema.index({ sold: -1 });

export default mongoose.model("Product", productSchema);
