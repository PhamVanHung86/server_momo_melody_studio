import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { validate } from "./validate.js";

const schema = z.object({
  name: z.string().min(1, "Cần có tên"),
});

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("validate middleware", () => {
  it("gọi next() khi dữ liệu hợp lệ, ghi đè req.body bằng dữ liệu đã parse", () => {
    const req = { body: { name: "Momo" } };
    const res = mockRes();
    const next = vi.fn();

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.body).toEqual({ name: "Momo" });
  });

  it("trả về 400 và KHÔNG gọi next() khi dữ liệu không hợp lệ", () => {
    const req = { body: { name: "" } };
    const res = mockRes();
    const next = vi.fn();

    validate(schema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });
});
