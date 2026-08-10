import { z } from "zod";

// Request thêm/sửa sản phẩm đi qua multipart/form-data (do có upload ảnh),
// nên mọi field đều đến dưới dạng string — dùng z.coerce để tự ép kiểu
// đúng (VD: "19000" → 19000) trước khi validate khoảng giá trị.
export const productSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên sản phẩm").max(200),
  description: z.string().trim().max(5000).optional().default(""),
  price: z.coerce
    .number({ message: "Giá phải là số" })
    .min(0, "Giá không được âm"),
  category: z.string().trim().min(1, "Vui lòng chọn danh mục"),
  bestseller: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
  stock: z.coerce
    .number({ message: "Tồn kho phải là số" })
    .int("Tồn kho phải là số nguyên")
    .min(0, "Tồn kho không được âm")
    .optional()
    .default(0),
});
