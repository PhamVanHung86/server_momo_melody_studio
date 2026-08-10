import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, default: null },
    googleId: { type: String, default: null },
    avatar: { type: String, default: null },
    nickname: { type: String, default: "" },
    mailClubSubscribed: { type: Boolean, default: false },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    // 🔑 Lưu HASH của refresh token (không lưu token gốc) để có thể revoke
    // khi cần (logout, đổi mật khẩu, phát hiện token bị lộ...). Mỗi thiết
    // bị đăng nhập tạo 1 refresh token riêng nên dùng mảng (hỗ trợ đa
    // thiết bị), mỗi phần tử tự hết hạn nên không cần dọn dẹp thủ công.
    refreshTokens: [
      {
        tokenHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    // ❤️ Danh sách sản phẩm yêu thích — chỉ lưu ID, không lưu snapshot dữ
    // liệu sản phẩm (populate khi cần) để không bị lệch dữ liệu khi sản
    // phẩm đổi giá/ảnh.
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
