import mongoose from "mongoose";

const mailClubCollectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true }, // VD: "Tháng 6/2025"
    month: { type: Number, required: true }, // 1-12
    year: { type: Number, required: true },
    description: { type: String, default: "" },
    images: [{ type: String }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model("MailClubCollection", mailClubCollectionSchema);
