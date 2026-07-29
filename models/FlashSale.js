import mongoose from "mongoose";

const flashSaleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Vui lòng nhập tiêu đề Flash Sale"],
    },
    discountPercent: {
      type: Number,
      required: [true, "Vui lòng nhập phần trăm giảm giá"],
      min: [0, "Phần trăm giảm giá tối thiểu là 0%"],
      max: [100, "Phần trăm giảm giá tối đa là 100%"],
    },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    startTime: {
      type: Date,
      required: [true, "Vui lòng chọn thời gian bắt đầu"],
    },
    endTime: {
      type: Date,
      required: [true, "Vui lòng chọn thời gian kết thúc"],
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model("FlashSale", flashSaleSchema);
