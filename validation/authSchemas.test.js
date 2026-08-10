import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "./authSchemas.js";

describe("registerSchema", () => {
  it("chấp nhận dữ liệu hợp lệ", () => {
    const result = registerSchema.safeParse({
      name: "Hùng",
      email: "Hung09058@gmail.com",
      password: "matkhau123",
    });
    expect(result.success).toBe(true);
    // Email được tự động lowercase + trim
    expect(result.data.email).toBe("hung09058@gmail.com");
  });

  it("từ chối mật khẩu quá ngắn", () => {
    const result = registerSchema.safeParse({
      name: "Hùng",
      email: "a@b.com",
      password: "123",
    });
    expect(result.success).toBe(false);
  });

  it("từ chối email không hợp lệ", () => {
    const result = registerSchema.safeParse({
      name: "Hùng",
      email: "khong-phai-email",
      password: "matkhau123",
    });
    expect(result.success).toBe(false);
  });

  it("từ chối tên rỗng", () => {
    const result = registerSchema.safeParse({
      name: "  ",
      email: "a@b.com",
      password: "matkhau123",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("chấp nhận dữ liệu hợp lệ", () => {
    const result = loginSchema.safeParse({
      email: "a@b.com",
      password: "bat-ky-gi",
    });
    expect(result.success).toBe(true);
  });

  it("từ chối thiếu mật khẩu", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "" });
    expect(result.success).toBe(false);
  });
});
