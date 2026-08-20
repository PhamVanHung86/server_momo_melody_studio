import Order from "../models/Order.js";
import Product from "../models/Product.js";
import MailClubSubscription from "../models/MailClubSubscription.js";
import { resend } from "../config/resend.js";
import Notification from "../models/Notification.js";
import mongoose from "mongoose";
import { activateSubscription } from "./mailClubController.js";
import User from "../models/User.js";
import { logError } from "../config/logger.js";
import { ORDER_STATUS, CANCELLABLE_STATUSES } from "../constants/orderStatus.js";
import { getActiveFlashSaleDiscountMap, applyFlashSalePrice } from "../utils/pricing.js";

const calcDeliveryFee = (subtotal) => {
  const FREE_SHIP_THRESHOLD = 300000;
  const FLAT_FEE = 20000;
  return subtotal >= FREE_SHIP_THRESHOLD ? 0 : FLAT_FEE;
};

// Chuẩn hoá tham số phân trang dùng chung cho các list endpoint bên dưới.
// Giữ nguyên hành vi "không truyền page → trả hết" để tương thích ngược
// với các chỗ gọi API cũ (giống pattern đã áp dụng ở productController.js),
// nhưng khuyến khích FE luôn truyền page/limit vì danh sách đơn hàng sẽ
// lớn dần theo thời gian.
function parsePagination(query) {
  const { page, limit } = query;
  if (!page) return null;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  return { pageNum, limitNum, skip: (pageNum - 1) * limitNum };
}

// Tạo đơn hàng mới
export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { items, shippingInfo, paymentMethod } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Giỏ hàng trống" });
    }

    // Gộp quantity theo product trước khi check tồn kho
    const mergedQuantities = {};
    for (const item of items) {
      mergedQuantities[item.product] =
        (mergedQuantities[item.product] || 0) + item.quantity;
    }

    // 💰 Lấy Flash Sale đang active TRƯỚC transaction (read-only, không cần
    // session) để tính giá thực tế — KHÔNG bao giờ tin giá do client gửi
    // lên (items[].price từ FE chỉ mang tính hiển thị/UX, còn số tiền tính
    // tiền luôn được recompute ở đây).
    const discountMap = await getActiveFlashSaleDiscountMap();

    let order;

    await session.withTransaction(async () => {
      let subtotal = 0;
      const verifiedItems = [];

      for (const item of items) {
        const product = await Product.findById(item.product).session(session);
        if (!product) {
          throw new Error(`Không tìm thấy sản phẩm: ${item.name}`);
        }

        const totalRequested = mergedQuantities[item.product];
        if (product.stock < totalRequested) {
          throw new Error(`${product.name} chỉ còn ${product.stock} sản phẩm`);
        }

        const actualPrice = applyFlashSalePrice(
          product.price,
          product._id,
          discountMap,
        );

        subtotal += actualPrice * item.quantity;
        verifiedItems.push({
          product: product._id,
          name: product.name,
          image: product.images?.[0] || "",
          price: actualPrice,
          originalPrice: product.price,
          quantity: item.quantity,
        });
      }

      const deliveryFee = calcDeliveryFee(subtotal);
      const total = subtotal + deliveryFee;

      // Trừ kho trong cùng transaction
      for (const [productId, qty] of Object.entries(mergedQuantities)) {
        await Product.findByIdAndUpdate(
          productId,
          { $inc: { stock: -qty, sold: qty } },
          { session },
        );
      }

      const createdOrders = await Order.create(
        [
          {
            user: req.user?.id || null,
            items: verifiedItems,
            shippingInfo,
            paymentMethod,
            subtotal,
            deliveryFee,
            total,
          },
        ],
        { session },
      );
      order = createdOrders[0];
      // 📩 Gửi email thông báo cho admin mỗi khi có đơn hàng mới
      try {
        const itemsHtml = order.items
          .map(
            (it) =>
              `<li>${it.name} x${it.quantity} — ${it.price.toLocaleString("vi-VN")}đ</li>`,
          )
          .join("");

        await resend.emails.send({
          from: "momo's melody studio <shop@momomeomeow.com>",
          to: process.env.ADMIN_EMAIL,
          subject: `🛍️ Đơn hàng mới #${order._id.toString().slice(-6)}`,
          html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #4A4A6A;">Có đơn hàng mới! 🌸</h2>
        <p><strong>Khách hàng:</strong> ${shippingInfo?.name || "—"}</p>
        <p><strong>SĐT:</strong> ${shippingInfo?.phone || "—"}</p>
        <p><strong>Sản phẩm:</strong></p>
        <ul style="background: #FFF0F5; padding: 16px 32px; border-radius: 12px; color: #4A4A6A;">
          ${itemsHtml}
        </ul>
        <p><strong>Tổng tiền:</strong> ${order.total.toLocaleString("vi-VN")}đ</p>
        
        <!-- 🎯 NÚT TRUY CẬP TRANG ADMIN MỚI -->
        <div style="margin-top: 28px; text-align: center;">
          <a href="https://adminmomomelody.netlify.app/" 
             target="_blank" 
             style="display: inline-block; background-color: #8B98E3; color: #ffffff; padding: 12px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 14px; box-shadow: 0 4px 10px rgba(139, 152, 227, 0.3);">
            👉 Vào trang Admin xử lý đơn hàng
          </a>
        </div>
      </div>
    `,
        });
      } catch (err) {
        logError(err, { where: "createOrder -> notify admin email" });
      }
    });

    let updatedUser = null;
    if (req.user?.id && shippingInfo) {
      try {
        const profileUpdate = {};
        if (shippingInfo.name?.trim())
          profileUpdate.name = shippingInfo.name.trim();
        if (shippingInfo.phone?.trim())
          profileUpdate.phone = shippingInfo.phone.trim();
        if (shippingInfo.address?.trim())
          profileUpdate.address = shippingInfo.address.trim();

        if (Object.keys(profileUpdate).length > 0) {
          updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            profileUpdate,
            { new: true },
          ).select("name email phone address avatar role");
        }
      } catch (err) {
        logError(err, { where: "createOrder -> sync profile" });
      }
    }

    res.status(201).json({ success: true, order, user: updatedUser });
  } catch (error) {
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// Lấy đơn hàng của user hiện tại (Client) — hỗ trợ phân trang tuỳ chọn
// qua ?page=&limit= (không truyền → giữ hành vi cũ: trả hết).
export const getMyOrders = async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    const filter = { user: req.user.id };

    if (!pagination) {
      const orders = await Order.find(filter).sort({ createdAt: -1 });
      return res.json({ success: true, orders });
    }

    const { pageNum, limitNum, skip } = pagination;
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Order.countDocuments(filter),
    ]);

    res.json({
      success: true,
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Lấy tất cả đơn hàng (Admin) — hỗ trợ phân trang + lọc theo status tuỳ
// chọn qua ?page=&limit=&status=. Trước đây luôn load TOÀN BỘ collection
// vào RAM (không giới hạn) — sẽ rất chậm khi số đơn lớn.
export const getAllOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const pagination = parsePagination(req.query);
    const filter = status ? { status } : {};

    if (!pagination) {
      const orders = await Order.find(filter)
        .populate("user", "name email")
        .sort({ createdAt: -1 });
      return res.json({ success: true, orders });
    }

    const { pageNum, limitNum, skip } = pagination;
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Order.countDocuments(filter),
    ]);

    res.json({
      success: true,
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Nội dung thông báo tương ứng với từng trạng thái đơn hàng
const ORDER_STATUS_NOTIFICATIONS = {
  [ORDER_STATUS.SHIPPING]: {
    title: "Đơn hàng đang được giao! 🚚",
    message: (order) =>
      `Đơn hàng #${order._id.toString().slice(-8).toUpperCase()} của bạn đang trên đường giao đến bạn.`,
  },
  [ORDER_STATUS.DELIVERED]: {
    title: "Đơn hàng đã được giao! 🎉",
    message: (order) =>
      `Đơn hàng #${order._id.toString().slice(-8).toUpperCase()} của bạn đã giao thành công. Cảm ơn bạn đã ủng hộ momo's melody studio!`,
  },
  [ORDER_STATUS.CANCELLED]: {
    title: "Đơn hàng đã bị huỷ",
    message: (order) =>
      `Đơn hàng #${order._id.toString().slice(-8).toUpperCase()} của bạn đã bị huỷ.`,
  },
};

/**
 * Hoàn lại tồn kho cho 1 đơn hàng bị huỷ (chỉ chạy đúng 1 lần nhờ điều
 * kiện stockRestored: false trong query — findOneAndUpdate là atomic nên
 * kể cả 2 request huỷ chạy song song cũng chỉ 1 request hoàn kho thành
 * công). Trả về true nếu vừa hoàn kho, false nếu đã hoàn trước đó rồi.
 */
async function restoreStockForOrder(orderId, session) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, stockRestored: false },
    { stockRestored: true },
    { session, new: false }, // trả về document TRƯỚC khi update để lấy items
  );
  if (!order) return false; // đã hoàn kho trước đó rồi, không làm lại

  for (const item of order.items) {
    await Product.findByIdAndUpdate(
      item.product,
      { $inc: { stock: item.quantity, sold: -item.quantity } },
      { session },
    );
  }
  return true;
}

// Cập nhật trạng thái đơn hàng (Admin)
export const updateOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { status } = req.body;

    let order;
    await session.withTransaction(async () => {
      order = await Order.findById(req.params.id).session(session);
      if (!order) throw new Error("Không tìm thấy đơn hàng");

      order.status = status;
      if (status === ORDER_STATUS.CANCELLED) {
        order.cancelledAt = order.cancelledAt || new Date();
        order.cancelledBy = order.cancelledBy || "admin";
        // 🔁 Hoàn kho — trước đây chuyển status sang "Đã hủy" không hề trả
        // lại stock, khiến tồn kho bị "khoá chết" vĩnh viễn mỗi lần huỷ đơn.
        await restoreStockForOrder(order._id, session);
      }
      await order.save({ session });
    });

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    // ✅ Chỉ tạo Notification nếu đơn hàng thuộc về một User đã đăng ký
    const notifDef = ORDER_STATUS_NOTIFICATIONS[status];
    if (notifDef && order.user) {
      await Notification.create({
        user: order.user,
        order: order._id,
        title: notifDef.title,
        message: notifDef.message(order),
        link: "/orders",
      });
    }

    res.json({ success: true, order });
  } catch (error) {
    const notFound = error.message === "Không tìm thấy đơn hàng";
    res.status(notFound ? 404 : 500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// Huỷ đơn hàng (Khách hàng tự huỷ đơn của chính mình)
// Chỉ cho phép huỷ khi đơn còn ở trạng thái có thể đảo ngược (chưa giao
// cho đơn vị vận chuyển) — xem CANCELLABLE_STATUSES. Sau khi đã "Đang
// giao"/"Đã giao" thì phải liên hệ admin xử lý thủ công.
export const cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { reason } = req.body;
    let order;

    await session.withTransaction(async () => {
      order = await Order.findById(req.params.id).session(session);
      if (!order) throw new Error("Không tìm thấy đơn hàng");

      // IDOR guard: chỉ chủ đơn hàng mới được huỷ
      if (!order.user || order.user.toString() !== req.user.id) {
        const err = new Error("Bạn không có quyền huỷ đơn hàng này");
        err.status = 403;
        throw err;
      }

      if (!CANCELLABLE_STATUSES.includes(order.status)) {
        const err = new Error(
          "Đơn hàng đang được xử lý/giao nên không thể tự huỷ. Vui lòng liên hệ chúng mình để được hỗ trợ.",
        );
        err.status = 400;
        throw err;
      }

      order.status = ORDER_STATUS.CANCELLED;
      order.cancelledAt = new Date();
      order.cancelledBy = "user";
      order.cancelReason = reason || "";
      await restoreStockForOrder(order._id, session);
      await order.save({ session });
    });

    res.json({ success: true, order });
  } catch (error) {
    res
      .status(error.status || 400)
      .json({ message: error.message || "Không thể huỷ đơn hàng" });
  } finally {
    session.endSession();
  }
};

// Đếm số đơn hàng đang chờ xác nhận (Admin)
export const getPendingOrdersCount = async (req, res) => {
  try {
    const count = await Order.countDocuments({
      status: ORDER_STATUS.PROCESSING,
    });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Xác nhận đơn hàng (Admin)
export const confirmOrder = async (req, res) => {
  try {
    const { sendEmail } = req.body;

    const order = await Order.findById(req.params.id).populate(
      "user",
      "name email",
    );
    if (!order)
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });

    if (order.status !== ORDER_STATUS.PROCESSING) {
      return res.status(400).json({
        message: "Đơn hàng này không ở trạng thái chờ xác nhận",
      });
    }

    order.status = ORDER_STATUS.CONFIRMED;
    order.confirmedAt = new Date();

    // Đồng bộ: nếu đơn này gắn với 1 gói Mail Club đang chờ xác nhận
    // thì kích hoạt gói luôn
    if (order.mailClubSubscription) {
      const sub = await MailClubSubscription.findById(
        order.mailClubSubscription,
      );
      if (sub && sub.status === "pending") {
        await activateSubscription(sub, "Xác nhận qua đơn hàng");
      }
    }

    // ✅ Chỉ tạo Notification nếu order có User (tránh crash với Guest)
    if (order.user?._id) {
      await Notification.create({
        user: order.user._id,
        order: order._id,
        title: "Đơn hàng đã được xác nhận! 🎀",
        message: `Đơn hàng #${order._id.toString().slice(-8).toUpperCase()} của bạn đã được xác nhận và đang được chuẩn bị.`,
        link: "/orders",
      });
    }

    let emailSent = false;
    const toEmail = order.user?.email || order.guestEmail;

    if (sendEmail && toEmail) {
      try {
        await resend.emails.send({
          from: "momo's melody studio <shop@momomeomeow.com>",
          to: toEmail,
          subject: "✅ Đơn hàng của bạn đã được xác nhận!",
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #4A4A6A;">Xin chào ${order.shippingInfo.name}! 🌸</h2>
              <p>Đơn hàng <strong>#${order._id.toString().slice(-8).toUpperCase()}</strong> của bạn đã được xác nhận và đang được chuẩn bị.</p>
              <div style="background: #FFF0F5; padding: 16px; border-radius: 12px; margin: 16px 0;">
                <p style="color: #4A4A6A; margin: 0;"><strong>Tổng tiền:</strong> ${order.total.toLocaleString()} đ</p>
                <p style="color: #4A4A6A;"><strong>Địa chỉ giao hàng:</strong> ${order.shippingInfo.address}</p>
                <p style="color: #4A4A6A;"><strong>Phương thức:</strong> ${order.paymentMethod === "cod" ? "Thanh toán khi nhận hàng (COD)" : "Chuyển khoản"}</p>
              </div>
              <p>Chúng mình sẽ sớm giao đơn hàng đến bạn. Cảm ơn bạn đã ủng hộ momo's melody studio! 🩷</p>
            </div>
          `,
        });
        emailSent = true;
        order.confirmationEmailSent = true;
      } catch (mailErr) {
        console.error("Gửi email xác nhận đơn hàng thất bại:", mailErr);
      }
    }

    await order.save();

    res.json({ success: true, order, emailSent });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Lấy số liệu thống kê Dashboard Admin
// ⚠️ Trước đây hàm này gọi Order.find() KHÔNG giới hạn (load toàn bộ đơn
// hàng vào RAM rồi filter/reduce bằng JS) — chắc chắn là bottleneck khi số
// đơn hàng lên tới hàng nghìn/chục nghìn. Giờ chuyển hết sang MongoDB
// aggregation pipeline, DB tự tính toán, chỉ trả về vài con số cuối cùng.
export const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [
      totalsAgg,
      todayAgg,
      pendingOrders,
      totalProducts,
      last7DaysAgg,
      recentOrders,
      uniqueCustomersAgg,
      mailClubStats,
      mailClubRevenue,
      expiringCount,
    ] = await Promise.all([
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$total" },
            totalOrders: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: today } } },
        { $group: { _id: null, revenue: { $sum: "$total" } } },
      ]),
      Order.countDocuments({ status: ORDER_STATUS.PROCESSING }),
      Product.countDocuments(),
      Order.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            revenue: { $sum: "$total" },
          },
        },
      ]),
      Order.find().sort({ createdAt: -1 }).limit(5),
      Order.aggregate([
        { $match: { user: { $ne: null } } },
        { $group: { _id: "$user" } },
        { $count: "count" },
      ]),
      MailClubSubscription.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      MailClubSubscription.aggregate([
        { $match: { status: { $in: ["active", "expired"] } } },
        { $group: { _id: "$plan", count: { $sum: 1 } } },
      ]),
      MailClubSubscription.countDocuments({
        status: "active",
        endDate: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    // Ghép revenue 7 ngày gần nhất theo đúng thứ tự ngày (kể cả ngày $0)
    const revenueByDay = new Map(
      last7DaysAgg.map((d) => [d._id, d.revenue]),
    );
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      last7Days.push({
        date: date.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        }),
        revenue: revenueByDay.get(key) || 0,
      });
    }

    const PLAN_PRICE = { monthly: 135000, quarterly: 364500 };
    const mailClubTotalRevenue = mailClubRevenue.reduce((sum, item) => {
      return sum + (PLAN_PRICE[item._id] || 0) * item.count;
    }, 0);

    const activeCount =
      mailClubStats.find((s) => s._id === "active")?.count || 0;
    const pendingCount =
      mailClubStats.find((s) => s._id === "pending")?.count || 0;
    const expiredCount =
      mailClubStats.find((s) => s._id === "expired")?.count || 0;

    res.json({
      success: true,
      stats: {
        totalRevenue: totalsAgg[0]?.totalRevenue || 0,
        todayRevenue: todayAgg[0]?.revenue || 0,
        totalOrders: totalsAgg[0]?.totalOrders || 0,
        pendingOrders,
        totalProducts,
        totalCustomers: uniqueCustomersAgg[0]?.count || 0,
        revenueChart: last7Days,
        recentOrders: recentOrders.map((o) => ({
          id: o._id.toString().slice(-8).toUpperCase(),
          customer: o.shippingInfo.name,
          total: o.total,
          status: o.status,
        })),
        mailClub: {
          active: activeCount,
          pending: pendingCount,
          expired: expiredCount,
          expiring: expiringCount,
          totalRevenue: mailClubTotalRevenue,
          monthlyCount:
            mailClubRevenue.find((r) => r._id === "monthly")?.count || 0,
          quarterlyCount:
            mailClubRevenue.find((r) => r._id === "quarterly")?.count || 0,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Lấy dữ liệu phân tích Analytics
// ⚠️ Cùng vấn đề với getDashboardStats — chuyển sang aggregation thay vì
// Order.find() + Product.find() rồi xử lý toàn bộ bằng JS.
export const getAnalytics = async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const now = new Date();

    let chartData = [];

    if (period === "week") {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      const revenueAgg = await Order.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$total" },
          },
        },
      ]);
      const byDay = new Map(revenueAgg.map((d) => [d._id, d.revenue]));
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const key = date.toISOString().slice(0, 10);
        chartData.push({
          label: date.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
          }),
          revenue: byDay.get(key) || 0,
        });
      }
    } else if (period === "month") {
      const start = new Date(now);
      start.setDate(start.getDate() - 28);
      const revenueAgg = await Order.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$total" },
          },
        },
      ]);
      const byDay = new Map(revenueAgg.map((d) => [d._id, d.revenue]));
      for (let i = 3; i >= 0; i--) {
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() - i * 7);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7);

        let revenue = 0;
        for (const [key, val] of byDay) {
          const d = new Date(key);
          if (d >= startDate && d < endDate) revenue += val;
        }
        chartData.push({ label: `Tuần ${4 - i}`, revenue });
      }
    } else if (period === "year") {
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const revenueAgg = await Order.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            revenue: { $sum: "$total" },
          },
        },
      ]);
      const byMonth = new Map(
        revenueAgg.map((d) => [`${d._id.year}-${d._id.month}`, d.revenue]),
      );
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        chartData.push({
          label: `Th${date.getMonth() + 1}`,
          revenue: byMonth.get(key) || 0,
        });
      }
    }

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    const [thisMonthAgg, lastMonthAgg, topProductsAgg, categoryAgg] =
      await Promise.all([
        Order.aggregate([
          { $match: { createdAt: { $gte: thisMonthStart } } },
          { $group: { _id: null, revenue: { $sum: "$total" } } },
        ]),
        Order.aggregate([
          {
            $match: {
              createdAt: { $gte: lastMonthStart, $lt: lastMonthEnd },
            },
          },
          { $group: { _id: null, revenue: { $sum: "$total" } } },
        ]),
        Order.aggregate([
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.product",
              name: { $first: "$items.name" },
              image: { $first: "$items.image" },
              sold: { $sum: "$items.quantity" },
              revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
            },
          },
          { $sort: { sold: -1 } },
          { $limit: 5 },
        ]),
        Order.aggregate([
          { $unwind: "$items" },
          {
            $lookup: {
              from: "products",
              localField: "items.product",
              foreignField: "_id",
              as: "productInfo",
            },
          },
          {
            $group: {
              _id: {
                $ifNull: [
                  { $arrayElemAt: ["$productInfo.category", 0] },
                  "khác",
                ],
              },
              revenue: {
                $sum: { $multiply: ["$items.price", "$items.quantity"] },
              },
            },
          },
          { $sort: { revenue: -1 } },
        ]),
      ]);

    const thisMonthRevenue = thisMonthAgg[0]?.revenue || 0;
    const lastMonthRevenue = lastMonthAgg[0]?.revenue || 0;
    const growthPercent =
      lastMonthRevenue > 0
        ? (
            ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) *
            100
          ).toFixed(1)
        : 0;

    const topProducts = topProductsAgg.map((p) => ({
      name: p.name,
      image: p.image,
      sold: p.sold,
      revenue: p.revenue,
    }));

    const categoryData = categoryAgg.map((c) => ({
      category: c._id,
      revenue: c.revenue,
    }));

    res.json({
      success: true,
      analytics: {
        chartData,
        thisMonthRevenue,
        lastMonthRevenue,
        growthPercent,
        topProducts,
        categoryData,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
