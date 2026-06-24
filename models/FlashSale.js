import mongoose from "mongoose";

const flashSaleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    discountPercent: { type: Number, required: true }, // 0-100
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model("FlashSale", flashSaleSchema);
