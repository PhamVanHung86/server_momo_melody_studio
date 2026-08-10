import { describe, it, expect } from "vitest";
import { escapeRegex } from "./escapeRegex.js";

describe("escapeRegex", () => {
  it("escape các ký tự đặc biệt của regex", () => {
    expect(escapeRegex("(a+)+")).toBe("\\(a\\+\\)\\+");
    expect(escapeRegex("a.b*c")).toBe("a\\.b\\*c");
    expect(escapeRegex("hello|world")).toBe("hello\\|world");
  });

  it("không đổi chuỗi bình thường không có ký tự đặc biệt", () => {
    expect(escapeRegex("thiệp mùa xuân")).toBe("thiệp mùa xuân");
  });

  it("chuỗi rỗng trả về rỗng", () => {
    expect(escapeRegex("")).toBe("");
  });

  it("chuỗi độc hại kiểu ReDoS không còn là regex nguy hiểm sau khi escape", () => {
    const malicious = "(a+)+$";
    const escaped = escapeRegex(malicious);
    // Sau khi escape, chuỗi này chỉ khớp chính xác literal "(a+)+$",
    // không còn được hiểu là group lồng nhau gây exponential backtracking.
    const regex = new RegExp(escaped);
    expect(regex.test("(a+)+$")).toBe(true);
    expect(regex.test("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!")).toBe(false);
  });
});
