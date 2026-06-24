// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import { v2 as cloudinary } from "cloudinary";
// import path from "path";
// import Product from "./models/Product.js";
// import { products } from "./data/productsRaw.js";

// dotenv.config();

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// // Thư mục chứa ảnh gốc (copy toàn bộ ảnh từ src/assets sang đây)
// const ASSETS_DIR = path.resolve("./assets");

// // Cache để không upload lại ảnh đã upload (nếu nhiều sản phẩm dùng chung 1 ảnh)
// const uploadCache = {};

// const uploadImage = async (fileName) => {
//   if (uploadCache[fileName]) return uploadCache[fileName];

//   const filePath = path.join(ASSETS_DIR, fileName);
//   const result = await cloudinary.uploader.upload(filePath, {
//     folder: "products",
//   });

//   uploadCache[fileName] = result.secure_url;
//   console.log(`Uploaded: ${fileName} -> ${result.secure_url}`);
//   return result.secure_url;
// };

// const seedDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGODB_URI);
//     console.log("Connected to MongoDB");

//     const productsWithUrls = [];

//     for (const product of products) {
//       const uploadedUrls = [];
//       for (const fileName of product.image) {
//         const url = await uploadImage(fileName);
//         uploadedUrls.push(url);
//       }

//       // Loại bỏ _id cũ (string dạng "aaaaa") và field "image" gốc
//       // (schema dùng "images", không phải "image") để Mongoose tự sinh ObjectId hợp lệ
//       const { _id, image, ...rest } = product;

//       productsWithUrls.push({ ...rest, images: uploadedUrls });
//     }

//     await Product.deleteMany({}); // bỏ dòng này nếu không muốn xóa data cũ
//     const result = await Product.insertMany(productsWithUrls);

//     console.log(`Đã thêm ${result.length} sản phẩm vào database`);
//     process.exit(0);
//   } catch (error) {
//     console.error("Lỗi seed data:", error);
//     process.exit(1);
//   }
// };

// seedDB();

import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Product from "./models/Product.js";

const updateStock = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB 🌸");

    const result = await Product.updateMany(
      { stock: { $exists: false } }, // chỉ update sản phẩm chưa có stock
      { $set: { stock: 50, sold: 0 } }, // set mặc định 50 sản phẩm trong kho
    );

    console.log(`✅ Đã cập nhật ${result.modifiedCount} sản phẩm!`);
    process.exit(0);
  } catch (error) {
    console.error("Lỗi:", error);
    process.exit(1);
  }
};

updateStock();
