import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cacheGet, cacheSet, cacheDel } from "./cache.js";

describe("cache", () => {
  beforeEach(() => {
    cacheDel(); // dọn sạch cache trước mỗi test
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("trả về null nếu key chưa tồn tại", () => {
    expect(cacheGet("khong-ton-tai")).toBeNull();
  });

  it("lưu và lấy lại đúng giá trị trong thời gian TTL", () => {
    cacheSet("banners", [{ id: 1 }], 5000);
    expect(cacheGet("banners")).toEqual([{ id: 1 }]);
  });

  it("tự hết hạn sau TTL", () => {
    cacheSet("banners", [{ id: 1 }], 1000);
    vi.advanceTimersByTime(1001);
    expect(cacheGet("banners")).toBeNull();
  });

  it("cacheDel(key) xoá đúng 1 key, không ảnh hưởng key khác", () => {
    cacheSet("a", 1, 5000);
    cacheSet("b", 2, 5000);
    cacheDel("a");
    expect(cacheGet("a")).toBeNull();
    expect(cacheGet("b")).toBe(2);
  });

  it("cacheDel() không tham số xoá toàn bộ cache", () => {
    cacheSet("a", 1, 5000);
    cacheSet("b", 2, 5000);
    cacheDel();
    expect(cacheGet("a")).toBeNull();
    expect(cacheGet("b")).toBeNull();
  });
});
