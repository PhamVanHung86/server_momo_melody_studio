import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    image: { type: String, required: true },
    launchDate: { type: Date }, // ngày ra mắt (tùy chọn — nếu có sẽ hiện countdown)
    linkTo: { type: String, default: "" }, // link khi click vào (tùy chọn)
    badge: { type: String, default: "Sắp ra mắt" },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 }, // thứ tự hiển thị
  },
  { timestamps: true },
);

export default mongoose.model("Banner", bannerSchema);
