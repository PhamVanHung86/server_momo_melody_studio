import Order from "../models/Order.js";

// Tạo đơn hàng mới (Client)
import Product from "../models/Product.js";

export const createOrder = async (req, res) => {
  try {
    const { items, shippingInfo, paymentMethod, subtotal, deliveryFee, total } =
      req.body;

    // Kiểm tra và trừ kho
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res
          .status(404)
          .json({ message: `Không tìm thấy sản phẩm: ${item.name}` });
      }
      if (product.stock < item.quantity) {
        return res
          .status(400)
          .json({ message: `${item.name} chỉ còn ${product.stock} sản phẩm` });
      }
    }

    // Trừ kho + tăng sold
    for (const item of items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity, sold: item.quantity },
      });
    }

    const order = await Order.create({
      user: req.user.id,
      items,
      shippingInfo,
      paymentMethod,
      subtotal,
      deliveryFee,
      total,
    });

    res.status(201).json({ success: true, order });
  } catch (error) {
    res.status(500).json({ message: error.message });
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

// Cập nhật trạng thái đơn hàng (Admin)
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );
    if (!order)
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Thêm vào cuối file:
export const getDashboardStats = async (req, res) => {
  try {
    const orders = await Order.find().populate("user", "name email");
    const products = await (
      await import("../models/Product.js")
    ).default.find();

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

    // Khách hàng unique
    const uniqueCustomers = new Set(orders.map((o) => o.user?._id?.toString()))
      .size;

    res.json({
      success: true,
      stats: {
        totalRevenue,
        todayRevenue,
        totalOrders: orders.length,
        pendingOrders,
        totalProducts: products.length,
        totalCustomers: uniqueCustomers,
        revenueChart: last7Days,
        recentOrders,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Thêm vào cuối file:
export const getAnalytics = async (req, res) => {
  try {
    const { period = "month" } = req.query; // week | month | year
    const Product = (await import("../models/Product.js")).default;

    const orders = await Order.find().populate("user", "name");
    const products = await Product.find();

    // ========== Doanh thu theo khoảng thời gian ==========
    const now = new Date();
    let chartData = [];

    if (period === "week") {
      // 7 ngày gần nhất
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
      // 30 ngày gần nhất, nhóm theo tuần
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
      // 12 tháng gần nhất
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

    // ========== So sánh tháng này vs tháng trước ==========
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

    // ========== Top sản phẩm bán chạy ==========
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

    // ========== Doanh thu theo danh mục ==========
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
