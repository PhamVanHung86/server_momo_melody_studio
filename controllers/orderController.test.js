import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

// 📩 orderController.js gọi resend.emails.send() để thông báo admin/khách.
// Mock hẳn module này để test không phụ thuộc mạng thật / API key thật —
// và để có thể assert "đã cố gắi gửi email" nếu cần mà không tốn network.
vi.mock("../config/resend.js", () => ({
  resend: { emails: { send: vi.fn().mockResolvedValue({}) } },
}));

// createOrder dùng mongoose.startSession().withTransaction(), YÊU CẦU
// MongoDB chạy dưới dạng replica set (đã ghi rõ trong .env.example) — nên
// test phải dùng MongoMemoryReplSet, không phải MongoMemoryServer thường.
let replSet;

import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import FlashSale from "../models/FlashSale.js";
import { ORDER_STATUS } from "../constants/orderStatus.js";
import {
  createOrder,
  updateOrderStatus,
  cancelOrder,
  confirmOrder,
} from "./orderController.js";

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const SHIPPING = {
  name: "Nguyễn Test",
  phone: "0900000000",
  address: "123 Test Street",
};

async function makeProduct(overrides = {}) {
  return Product.create({
    name: "Sticker mèo",
    price: 50000,
    category: "stickers",
    stock: 10,
    sold: 0,
    ...overrides,
  });
}

async function makeUser(overrides = {}) {
  return User.create({
    name: "Test User",
    email: `user-${Date.now()}-${Math.random()}@test.com`,
    password: "hashed",
    ...overrides,
  });
}

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

beforeEach(async () => {
  await Promise.all([
    Order.deleteMany({}),
    Product.deleteMany({}),
    User.deleteMany({}),
    FlashSale.deleteMany({}),
  ]);
  vi.clearAllMocks();
});

describe("createOrder", () => {
  it("tạo đơn hàng thành công và trừ đúng tồn kho", async () => {
    const product = await makeProduct({ stock: 10 });
    const user = await makeUser();

    const req = {
      user: { id: user._id.toString() },
      body: {
        items: [{ product: product._id.toString(), name: product.name, quantity: 2 }],
        shippingInfo: SHIPPING,
        paymentMethod: "cod",
      },
    };
    const res = mockRes();

    await createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.order.subtotal).toBe(100000);

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.stock).toBe(8);
    expect(updatedProduct.sold).toBe(2);
  });

  it("từ chối khi số lượng đặt vượt quá tồn kho", async () => {
    const product = await makeProduct({ stock: 1 });
    const user = await makeUser();

    const req = {
      user: { id: user._id.toString() },
      body: {
        items: [{ product: product._id.toString(), name: product.name, quantity: 5 }],
        shippingInfo: SHIPPING,
        paymentMethod: "cod",
      },
    };
    const res = mockRes();

    await createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    // Tồn kho không được đổi khi transaction rollback
    const unchanged = await Product.findById(product._id);
    expect(unchanged.stock).toBe(1);
  });

  it("gộp đúng quantity khi FE gửi trùng 2 dòng cùng 1 sản phẩm rồi mới check tồn kho", async () => {
    const product = await makeProduct({ stock: 3 });
    const user = await makeUser();

    const req = {
      user: { id: user._id.toString() },
      body: {
        items: [
          { product: product._id.toString(), name: product.name, quantity: 2 },
          { product: product._id.toString(), name: product.name, quantity: 2 },
        ],
        shippingInfo: SHIPPING,
        paymentMethod: "cod",
      },
    };
    const res = mockRes();

    await createOrder(req, res);

    // Tổng gộp là 4 > stock 3 → phải bị từ chối
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("ÁP DỤNG GIÁ FLASH SALE server-side, KHÔNG tin giá client gửi lên", async () => {
    const product = await makeProduct({ price: 100000, stock: 10 });
    const user = await makeUser();

    await FlashSale.create({
      title: "Sale sốc",
      discountPercent: 20,
      products: [product._id],
      startTime: new Date(Date.now() - 60 * 1000),
      endTime: new Date(Date.now() + 60 * 60 * 1000),
      active: true,
    });

    const req = {
      user: { id: user._id.toString() },
      body: {
        items: [
          {
            product: product._id.toString(),
            name: product.name,
            quantity: 1,
            // ⚠️ Client cố tình gửi giá SAI (giả mạo giá 1đ) — backend
            // phải bỏ qua hoàn toàn giá trị này.
            price: 1,
          },
        ],
        shippingInfo: SHIPPING,
        paymentMethod: "cod",
      },
    };
    const res = mockRes();

    await createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0];
    // Giá gốc 100,000 - 20% = 80,000 — KHÔNG PHẢI giá gian lận (1) và
    // KHÔNG PHẢI giá gốc chưa giảm (100,000).
    expect(payload.order.subtotal).toBe(80000);
    expect(payload.order.items[0].price).toBe(80000);
    expect(payload.order.items[0].originalPrice).toBe(100000);
  });

  it("không áp dụng giảm giá cho sản phẩm KHÔNG nằm trong Flash Sale", async () => {
    const productOnSale = await makeProduct({ name: "A", price: 100000 });
    const productNotOnSale = await makeProduct({ name: "B", price: 50000 });
    const user = await makeUser();

    await FlashSale.create({
      title: "Sale sốc",
      discountPercent: 50,
      products: [productOnSale._id],
      startTime: new Date(Date.now() - 60 * 1000),
      endTime: new Date(Date.now() + 60 * 60 * 1000),
      active: true,
    });

    const req = {
      user: { id: user._id.toString() },
      body: {
        items: [
          { product: productNotOnSale._id.toString(), name: "B", quantity: 1 },
        ],
        shippingInfo: SHIPPING,
        paymentMethod: "cod",
      },
    };
    const res = mockRes();

    await createOrder(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.order.items[0].price).toBe(50000); // giá gốc, không giảm
  });
});

describe("updateOrderStatus (admin) — hoàn kho khi huỷ", () => {
  it("hoàn lại tồn kho khi admin chuyển status sang Đã hủy", async () => {
    const product = await makeProduct({ stock: 5, sold: 2 });
    const order = await Order.create({
      items: [
        {
          product: product._id,
          name: product.name,
          price: 50000,
          originalPrice: 50000,
          quantity: 2,
        },
      ],
      shippingInfo: SHIPPING,
      subtotal: 100000,
      deliveryFee: 20000,
      total: 120000,
      status: ORDER_STATUS.PROCESSING,
    });

    const req = { params: { id: order._id.toString() }, body: { status: ORDER_STATUS.CANCELLED } };
    const res = mockRes();

    await updateOrderStatus(req, res);

    expect(res.status).not.toHaveBeenCalledWith(500);
    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.stock).toBe(7); // 5 + 2
    expect(updatedProduct.sold).toBe(0); // 2 - 2

    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder.stockRestored).toBe(true);
  });

  it("KHÔNG hoàn kho 2 lần nếu status bị đổi sang Đã hủy nhiều lần", async () => {
    const product = await makeProduct({ stock: 5 });
    const order = await Order.create({
      items: [
        {
          product: product._id,
          name: product.name,
          price: 50000,
          originalPrice: 50000,
          quantity: 2,
        },
      ],
      shippingInfo: SHIPPING,
      subtotal: 100000,
      deliveryFee: 20000,
      total: 120000,
      status: ORDER_STATUS.CANCELLED,
      stockRestored: true, // đã hoàn kho từ trước
    });

    const req = { params: { id: order._id.toString() }, body: { status: ORDER_STATUS.CANCELLED } };
    const res = mockRes();

    await updateOrderStatus(req, res);

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.stock).toBe(5); // KHÔNG cộng thêm lần nữa
  });
});

describe("cancelOrder (khách hàng tự huỷ)", () => {
  it("cho phép chủ đơn hàng huỷ đơn khi còn ở trạng thái Đang xử lý, và hoàn kho", async () => {
    const product = await makeProduct({ stock: 5 });
    const user = await makeUser();
    const order = await Order.create({
      user: user._id,
      items: [
        {
          product: product._id,
          name: product.name,
          price: 50000,
          originalPrice: 50000,
          quantity: 1,
        },
      ],
      shippingInfo: SHIPPING,
      subtotal: 50000,
      deliveryFee: 20000,
      total: 70000,
      status: ORDER_STATUS.PROCESSING,
    });

    const req = {
      params: { id: order._id.toString() },
      user: { id: user._id.toString() },
      body: { reason: "Đổi ý" },
    };
    const res = mockRes();

    await cancelOrder(req, res);

    expect(res.status).not.toHaveBeenCalled(); // 200 mặc định, không set status lỗi
    const updated = await Order.findById(order._id);
    expect(updated.status).toBe(ORDER_STATUS.CANCELLED);
    expect(updated.cancelledBy).toBe("user");

    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.stock).toBe(6);
  });

  it("CHẶN người khác huỷ đơn không phải của mình (IDOR)", async () => {
    const product = await makeProduct();
    const owner = await makeUser();
    const attacker = await makeUser();
    const order = await Order.create({
      user: owner._id,
      items: [{ product: product._id, name: product.name, price: 50000, originalPrice: 50000, quantity: 1 }],
      shippingInfo: SHIPPING,
      subtotal: 50000,
      deliveryFee: 20000,
      total: 70000,
      status: ORDER_STATUS.PROCESSING,
    });

    const req = {
      params: { id: order._id.toString() },
      user: { id: attacker._id.toString() },
      body: {},
    };
    const res = mockRes();

    await cancelOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    const unchanged = await Order.findById(order._id);
    expect(unchanged.status).toBe(ORDER_STATUS.PROCESSING);
  });

  it("KHÔNG cho huỷ khi đơn đã ở trạng thái Đang giao", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const order = await Order.create({
      user: user._id,
      items: [{ product: product._id, name: product.name, price: 50000, originalPrice: 50000, quantity: 1 }],
      shippingInfo: SHIPPING,
      subtotal: 50000,
      deliveryFee: 20000,
      total: 70000,
      status: ORDER_STATUS.SHIPPING,
    });

    const req = {
      params: { id: order._id.toString() },
      user: { id: user._id.toString() },
      body: {},
    };
    const res = mockRes();

    await cancelOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const unchanged = await Order.findById(order._id);
    expect(unchanged.status).toBe(ORDER_STATUS.SHIPPING);
  });
});

describe("confirmOrder (admin)", () => {
  it("xác nhận đơn từ Đang xử lý sang Đã xác nhận", async () => {
    const product = await makeProduct();
    const order = await Order.create({
      items: [{ product: product._id, name: product.name, price: 50000, originalPrice: 50000, quantity: 1 }],
      shippingInfo: SHIPPING,
      subtotal: 50000,
      deliveryFee: 20000,
      total: 70000,
      status: ORDER_STATUS.PROCESSING,
    });

    const req = { params: { id: order._id.toString() }, body: { sendEmail: false } };
    const res = mockRes();

    await confirmOrder(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.order.status).toBe(ORDER_STATUS.CONFIRMED);
  });

  it("từ chối xác nhận đơn không ở trạng thái Đang xử lý", async () => {
    const product = await makeProduct();
    const order = await Order.create({
      items: [{ product: product._id, name: product.name, price: 50000, originalPrice: 50000, quantity: 1 }],
      shippingInfo: SHIPPING,
      subtotal: 50000,
      deliveryFee: 20000,
      total: 70000,
      status: ORDER_STATUS.CONFIRMED,
    });

    const req = { params: { id: order._id.toString() }, body: { sendEmail: false } };
    const res = mockRes();

    await confirmOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
