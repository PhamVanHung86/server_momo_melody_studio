import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { applyFlashSalePrice } from "./pricing.js";

describe("applyFlashSalePrice", () => {
  const productId = new mongoose.Types.ObjectId();

  it("giữ nguyên giá gốc nếu sản phẩm không nằm trong Flash Sale", () => {
    const map = new Map();
    expect(applyFlashSalePrice(100000, productId, map)).toBe(100000);
  });

  it("áp dụng đúng % giảm giá khi sản phẩm nằm trong Flash Sale", () => {
    const map = new Map([[productId.toString(), 20]]);
    expect(applyFlashSalePrice(100000, productId, map)).toBe(80000);
  });

  it("làm tròn đúng khi giá giảm ra số thập phân", () => {
    const map = new Map([[productId.toString(), 33]]);
    // 100,000 * 0.67 = 67,000 chẵn — thử số lẻ hơn
    expect(applyFlashSalePrice(99999, productId, map)).toBe(
      Math.round(99999 * 0.67),
    );
  });

  it("chấp nhận productId dạng string lẫn ObjectId", () => {
    const map = new Map([[productId.toString(), 10]]);
    expect(applyFlashSalePrice(1000, productId.toString(), map)).toBe(900);
  });
});
