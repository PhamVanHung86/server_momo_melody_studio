import mongoose from "mongoose";
import { ORDER_STATUS, ORDER_STATUS_VALUES } from "../constants/orderStatus.js";

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    guestEmail: { type: String, default: "" },
    items: [
      {
        // ⚠️ Đổi từ String → ObjectId ref "Product" (trước đây là String,
        // mất khả năng populate() và toàn vẹn tham chiếu). Vẫn giữ lại
        // name/image/price như một SNAPSHOT tại thời điểm đặt hàng (không
        // populate lại từ Product để tránh hiển thị sai nếu sản phẩm đổi
        // giá/tên/ảnh sau này) — đây là denormalization có chủ đích, không
        // phải lỗi.
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: String,
        image: String,
        price: Number,
        // 💰 Giá gốc (trước giảm giá Flash Sale) tại thời điểm đặt hàng —
        // lưu lại để đối soát/audit sau này khi cần biết khách được giảm
        // bao nhiêu. Nếu không có flash sale thì originalPrice === price.
        originalPrice: Number,
        quantity: Number,
      },
    ],
    shippingInfo: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      note: String,
    },
    paymentMethod: { type: String, enum: ["cod", "transfer"], default: "cod" },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ORDER_STATUS_VALUES,
      default: ORDER_STATUS.PROCESSING,
    },
    confirmedAt: { type: Date, default: null },
    confirmationEmailSent: { type: Boolean, default: false },
    // 🚫 Huỷ đơn
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, enum: ["user", "admin", null], default: null },
    cancelReason: { type: String, default: "" },
    // ✅ Đánh dấu đã hoàn kho hay chưa — chống hoàn kho 2 lần nếu status bị
    // đổi qua lại "Đã hủy" nhiều lần hoặc 2 request huỷ chạy song song
    // (xem orderController.js::cancelOrder/updateOrderStatus).
    stockRestored: { type: Boolean, default: false },
    mailClubSubscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MailClubSubscription",
      default: null,
    },
  },
  { timestamps: true },
);

// 📈 Index cho các truy vấn phổ biến nhất:
// - user + createdAt: "đơn hàng của tôi" (getMyOrders), sort mới nhất trước
// - status: lọc theo trạng thái ở trang Admin Orders
// - createdAt: sort mặc định getAllOrders, group theo ngày ở dashboard
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model("Order", orderSchema);
