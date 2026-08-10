import { describe, it, expect } from "vitest";
import { productSchema } from "./productSchemas.js";

describe("productSchema", () => {
  it("chấp nhận dữ liệu hợp lệ và ép kiểu string -> number (multipart form-data)", () => {
    const result = productSchema.safeParse({
      name: "Thiệp mùa xuân",
      description: "Thiệp handmade",
      price: "19000", // multipart form-data luôn gửi string
      category: "postcard",
      bestseller: "true",
      stock: "10",
    });
    expect(result.success).toBe(true);
    expect(result.data.price).toBe(19000);
    expect(result.data.stock).toBe(10);
    expect(result.data.bestseller).toBe(true);
  });

  it("từ chối giá âm", () => {
    const result = productSchema.safeParse({
      name: "Thiệp",
      price: "-5000",
      category: "postcard",
    });
    expect(result.success).toBe(false);
  });

  it("từ chối tồn kho âm", () => {
    const result = productSchema.safeParse({
      name: "Thiệp",
      price: "10000",
      category: "postcard",
      stock: "-1",
    });
    expect(result.success).toBe(false);
  });

  it("từ chối thiếu tên sản phẩm", () => {
    const result = productSchema.safeParse({
      price: "10000",
      category: "postcard",
    });
    expect(result.success).toBe(false);
  });

  it("từ chối giá không phải số", () => {
    const result = productSchema.safeParse({
      name: "Thiệp",
      price: "không phải số",
      category: "postcard",
    });
    expect(result.success).toBe(false);
  });

  it("bestseller mặc định false nếu không truyền", () => {
    const result = productSchema.safeParse({
      name: "Thiệp",
      price: "10000",
      category: "postcard",
    });
    expect(result.success).toBe(true);
    expect(result.data.bestseller).toBe(false);
  });
});
