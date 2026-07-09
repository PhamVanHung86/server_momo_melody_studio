import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    // Thông tin khách hàng
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, default: "" },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Gói đăng ký
    plan: { type: String, enum: ["monthly", "quarterly"], required: true },

    // Thời gian
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },

    // Trạng thái
    status: {
      type: String,
      enum: ["pending", "active", "expired", "cancelled"],
      default: "pending",
    },

    // Lịch sử gia hạn
    renewalHistory: [
      {
        renewedAt: { type: Date },
        plan: { type: String },
        startDate: { type: Date },
        endDate: { type: Date },
        note: { type: String },
      },
    ],

    // Ghi chú admin
    adminNote: { type: String, default: "" },
  },
  { timestamps: true },
);

export default mongoose.model("MailClubSubscription", subscriptionSchema);
