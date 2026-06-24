import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, default: null },
    googleId: { type: String, default: null },
    avatar: { type: String, default: null },
    nickname: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
