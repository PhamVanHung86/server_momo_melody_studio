import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import User from "./models/User.js";

const setAdmin = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const email = "admin@gmail.com"; // ← thay email của bạn

  const user = await User.findOneAndUpdate(
    { email },
    { role: "admin" },
    { returnDocument: "after" },
  );

  if (user) {
    console.log(`✅ Đã set admin cho: ${user.email}`);
  } else {
    console.log("❌ Không tìm thấy user với email này");
  }

  process.exit(0);
};

setAdmin();
