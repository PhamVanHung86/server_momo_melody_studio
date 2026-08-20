import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên").max(100),
  email: z.string().trim().toLowerCase().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự").max(72),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

export const setPasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "Mật khẩu mới phải có ít nhất 6 ký tự").max(72),
});

// Request cập nhật hồ sơ đi qua multipart/form-data (có upload avatar) nên
// mọi field đều đến dưới dạng string. Trước đây route này không hề chạy
// qua validate() nào — name/phone/address được ghi thẳng vào DB không giới
// hạn độ dài/định dạng.
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Tên không được để trống").max(100).optional(),
  phone: z
    .string()
    .trim()
    .max(20, "Số điện thoại không hợp lệ")
    .optional()
    .or(z.literal("")),
  address: z
    .string()
    .trim()
    .max(500, "Địa chỉ quá dài")
    .optional()
    .or(z.literal("")),
});
