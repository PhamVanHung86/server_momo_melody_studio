import Order from "../models/Order.js";
import Product from "../models/Product.js";
import MailClubSubscription from "../models/MailClubSubscription.js";
import { resend } from "../config/resend.js";
import Notification from "../models/Notification.js";
import mongoose from "mongoose";
import { activateSubscription } from "./mailClubController.js";
import User from "../models/User.js";
import { logError } from "../config/logger.js";

const calcDeliveryFee = (subtotal) => {
  const FREE_SHIP_THRESHOLD = 300000;
  const FLAT_FEE = 20000;
  return subtotal >= FREE_SHIP_THRESHOLD ? 0 : FLAT_FEE;
};

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

        subtotal += product.price * item.quantity;
        verifiedItems.push({
          product: product._id.toString(),
          name: product.name,
          image: product.images?.[0] || "",
          price: product.price,
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
          from: "momo's melody studio <onboarding@resend.dev>",
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

// Lấy đơn hàng của user hiện tại (Client)
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort({
      createdAt: -1,
    });
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Lấy tất cả đơn hàng (Admin)
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Nội dung thông báo tương ứng với từng trạng thái đơn hàng
const ORDER_STATUS_NOTIFICATIONS = {
  "Đang giao": {
    title: "Đơn hàng đang được giao! 🚚",
    message: (order) =>
      `Đơn hàng #${order._id.toString().slice(-8).toUpperCase()} của bạn đang trên đường giao đến bạn.`,
  },
  "Đã giao": {
    title: "Đơn hàng đã được giao! 🎉",
    message: (order) =>
      `Đơn hàng #${order._id.toString().slice(-8).toUpperCase()} của bạn đã giao thành công. Cảm ơn bạn đã ủng hộ momo's melody studio!`,
  },
};

// Cập nhật trạng thái đơn hàng (Admin)
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { returnDocument: "after" },
    );
    if (!order)
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });

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
    res.status(500).json({ message: error.message });
  }
};

// Đếm số đơn hàng đang chờ xác nhận (Admin)
export const getPendingOrdersCount = async (req, res) => {
  try {
    const count = await Order.countDocuments({ status: "Đang xử lý" });
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

    if (order.status !== "Đang xử lý") {
      return res.status(400).json({
        message: "Đơn hàng này không ở trạng thái chờ xác nhận",
      });
    }

    order.status = "Đã xác nhận";
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
          from: "momo's melody studio <onboarding@resend.dev>",
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
export const getDashboardStats = async (req, res) => {
  try {
    const orders = await Order.find().populate("user", "name email");

    // ✅ Sửa lỗi: Gọi đúng Product.countDocuments() thay vì Order.find()
    const totalProducts = await Product.countDocuments();

    // Tổng doanh thu
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);

    // Doanh thu hôm nay
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRevenue = orders
      .filter((o) => new Date(o.createdAt) >= today)
      .reduce((sum, o) => sum + o.total, 0);

    // Đơn hàng đang chờ xử lý
    const pendingOrders = orders.filter(
      (o) => o.status === "Đang xử lý",
    ).length;

    // Doanh thu 7 ngày gần nhất
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayRevenue = orders
        .filter((o) => {
          const orderDate = new Date(o.createdAt);
          return orderDate >= date && orderDate < nextDate;
        })
        .reduce((sum, o) => sum + o.total, 0);

      last7Days.push({
        date: date.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        }),
        revenue: dayRevenue,
      });
    }

    // Đơn hàng gần đây (5 đơn mới nhất)
    const recentOrders = orders
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map((o) => ({
        id: o._id.toString().slice(-8).toUpperCase(),
        customer: o.shippingInfo.name,
        total: o.total,
        status: o.status,
      }));

    // ✅ Sửa lỗi: Lọc bỏ undefined khi đếm khách hàngunique
    const uniqueCustomers = new Set(
      orders.map((o) => o.user?._id?.toString()).filter(Boolean),
    ).size;

    const mailClubStats = await MailClubSubscription.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const mailClubRevenue = await MailClubSubscription.aggregate([
      {
        $match: { status: { $in: ["active", "expired"] } },
      },
      {
        $group: {
          _id: "$plan",
          count: { $sum: 1 },
        },
      },
    ]);

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

    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    const expiringCount = await MailClubSubscription.countDocuments({
      status: "active",
      endDate: { $gte: new Date(), $lte: in7Days },
    });

    res.json({
      success: true,
      stats: {
        totalRevenue,
        todayRevenue,
        totalOrders: orders.length,
        pendingOrders,
        totalProducts, // ✅ Đã truyền đúng số lượng sản phẩm
        totalCustomers: uniqueCustomers,
        revenueChart: last7Days,
        recentOrders,
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
export const getAnalytics = async (req, res) => {
  try {
    const { period = "month" } = req.query;

    const orders = await Order.find().populate("user", "name");
    const products = await Product.find();

    const now = new Date();
    let chartData = [];

    if (period === "week") {
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const revenue = orders
          .filter((o) => {
            const d = new Date(o.createdAt);
            return d >= date && d < nextDate;
          })
          .reduce((sum, o) => sum + o.total, 0);

        chartData.push({
          label: date.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
          }),
          revenue,
        });
      }
    } else if (period === "month") {
      for (let i = 3; i >= 0; i--) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - i * 7);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7);

        const revenue = orders
          .filter((o) => {
            const d = new Date(o.createdAt);
            return d >= startDate && d < endDate;
          })
          .reduce((sum, o) => sum + o.total, 0);

        chartData.push({
          label: `Tuần ${4 - i}`,
          revenue,
        });
      }
    } else if (period === "year") {
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const month = date.getMonth();
        const year = date.getFullYear();

        const revenue = orders
          .filter((o) => {
            const d = new Date(o.createdAt);
            return d.getMonth() === month && d.getFullYear() === year;
          })
          .reduce((sum, o) => sum + o.total, 0);

        chartData.push({
          label: `Th${month + 1}`,
          revenue,
        });
      }
    }

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonthRevenue = orders
      .filter((o) => new Date(o.createdAt) >= thisMonthStart)
      .reduce((sum, o) => sum + o.total, 0);

    const lastMonthRevenue = orders
      .filter((o) => {
        const d = new Date(o.createdAt);
        return d >= lastMonthStart && d < lastMonthEnd;
      })
      .reduce((sum, o) => sum + o.total, 0);

    const growthPercent =
      lastMonthRevenue > 0
        ? (
            ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) *
            100
          ).toFixed(1)
        : 0;

    const productSales = {};
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const key = item.product?.toString() || item.name;
        if (!productSales[key]) {
          productSales[key] = {
            name: item.name,
            image: item.image,
            sold: 0,
            revenue: 0,
          };
        }
        productSales[key].sold += item.quantity;
        productSales[key].revenue += item.price * item.quantity;
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5);

    const categoryRevenue = {};
    for (const order of orders) {
      for (const item of order.items) {
        const product = products.find(
          (p) => p._id.toString() === item.product?.toString(),
        );
        const category = product?.category || "khác";
        categoryRevenue[category] =
          (categoryRevenue[category] || 0) + item.price * item.quantity;
      }
    }

    const categoryData = Object.entries(categoryRevenue)
      .map(([category, revenue]) => ({
        category,
        revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue);

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
