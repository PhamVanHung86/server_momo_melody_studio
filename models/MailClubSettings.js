import mongoose from "mongoose";

const mailClubSettingsSchema = new mongoose.Schema(
  {
    isOpen: { type: Boolean, default: false },
    closeAt: { type: Date, default: null }, // thời gian đóng form
    openMessage: { type: String, default: "Đăng ký Mail Club ngay!" },
    closedMessage: {
      type: String,
      default: "Form đăng ký đã đóng. Hẹn gặp bạn tháng sau! 🌸",
    },
  },
  { timestamps: true },
);

export default mongoose.model("MailClubSettings", mailClubSettingsSchema);
