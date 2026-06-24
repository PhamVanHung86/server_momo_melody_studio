import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    images: [{ type: String }],
    bestseller: { type: Boolean, default: false },
    stock: { type: Number, default: 0 },
    sold: { type: Number, default: 0 },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.model("Product", productSchema);
