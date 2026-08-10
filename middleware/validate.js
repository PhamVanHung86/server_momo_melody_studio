// Middleware validate request bằng Zod schema — dùng chung cho toàn bộ
// route thay vì mỗi controller tự viết if/else check tay từng field (dễ
// sót, không đồng nhất thông báo lỗi).
//
// Cách dùng:
//   router.post("/register", validate(registerSchema), register);
//
// Nếu hợp lệ: request đi tiếp, req.body được GHI ĐÈ bằng dữ liệu đã qua
// zod (đã ép kiểu đúng, VD: "19000" từ form-data → number 19000).
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return res.status(400).json({
      success: false,
      message: firstError?.message || "Dữ liệu không hợp lệ",
      errors: result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  }
  req.body = result.data;
  next();
};

export default validate;
