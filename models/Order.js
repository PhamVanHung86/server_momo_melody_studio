import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [
      {
        product: String,
        name: String,
        image: String,
        price: Number,
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
      enum: ["Đang xử lý", "Đang giao", "Đã giao", "Đã hủy"],
      default: "Đang xử lý",
    },
  },
  { timestamps: true },
);

export default mongoose.model("Order", orderSchema);
