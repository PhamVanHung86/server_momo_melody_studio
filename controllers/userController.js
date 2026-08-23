import User from "../models/User.js";
import Order from "../models/Order.js";
import MailClubSubscription from "../models/MailClubSubscription.js";
import { processNewCycle } from "./mailClubController.js";
import { PLAN_PRICE } from "../config/mailClubPricing.js";

export const getCustomers = async (req, res) => {
  try {
    await processNewCycle();

    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    if (users.length === 0) {
      return res.json({ success: true, customers: [] });
    }

    const userIds = users.map((u) => u._id);
    const emails = users.map((u) => u.email);

    const orderStats = await Order.aggregate([
      {
        $match: { user: { $in: userIds }, status: { $ne: "Đã hủy" } },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$user",
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$total" },
          latestPhone: { $first: "$shippingInfo.phone" },
          latestAddress: { $first: "$shippingInfo.address" },
        },
      },
    ]);

    const orderStatsMap = new Map(
      orderStats.map((stat) => [stat._id.toString(), stat]),
    );

    const allPaidSubs = await MailClubSubscription.find({
      email: { $in: emails },
      status: { $in: ["active", "expired"] },
    }).lean();

    const linkedOrders = await Order.find({
      mailClubSubscription: { $ne: null },
      status: { $ne: "Đã hủy" },
    })
      .select("mailClubSubscription")
      .lean();
    const linkedSubIds = new Set(
      linkedOrders.map((o) => o.mailClubSubscription?.toString()),
    );

    const mailClubSpentByEmail = new Map();
    for (const sub of allPaidSubs) {
      if (linkedSubIds.has(sub._id.toString())) continue;
      const price = PLAN_PRICE[sub.plan] || 0;
      mailClubSpentByEmail.set(
        sub.email,
        (mailClubSpentByEmail.get(sub.email) || 0) + price,
      );
    }

    const activeSubs = allPaidSubs.filter((s) => s.status === "active");
    const mailClubMap = new Map(activeSubs.map((sub) => [sub.email, sub]));

    const customersWithStats = users.map((user) => {
      const stats = orderStatsMap.get(user._id.toString()) || {};
      const mailClubSub = mailClubMap.get(user.email);
      const mailClubSpent = mailClubSpentByEmail.get(user.email) || 0;

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        nickname: user.nickname || "",
        mailClubSubscribed: !!mailClubSub,
        mailClubPlan: mailClubSub?.plan || null,
        mailClubEndDate: mailClubSub?.endDate || null,
        phone: user.phone || stats.latestPhone || mailClubSub?.phone || "",
        address:
          user.address || stats.latestAddress || mailClubSub?.address || "",
        createdAt: user.createdAt,
        totalOrders: stats.totalOrders || 0,
        totalSpent: (stats.totalSpent || 0) + mailClubSpent,
      };
    });

    res.json({ success: true, customers: customersWithStats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateNickname = async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { nickname },
      { returnDocument: "after" },
    ).select("-password");

    if (!user)
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCustomerDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password").lean();
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });

    const orders = await Order.find({ user: id }).sort({ createdAt: -1 });

    const validOrders = orders.filter((o) => o.status !== "Đã hủy");
    const totalSpent = validOrders.reduce((sum, o) => sum + o.total, 0);

    const mailClubSub = await MailClubSubscription.findOne({
      email: user.email,
      status: "active",
    }).lean();

    const allPaidSubs = await MailClubSubscription.find({
      email: user.email,
      status: { $in: ["active", "expired"] },
    }).lean();
    const linkedOrders = await Order.find({
      mailClubSubscription: { $ne: null },
      status: { $ne: "Đã hủy" },
    })
      .select("mailClubSubscription")
      .lean();
    const linkedSubIds = new Set(
      linkedOrders.map((o) => o.mailClubSubscription?.toString()),
    );
    const mailClubSpent = allPaidSubs.reduce((sum, sub) => {
      if (linkedSubIds.has(sub._id.toString())) return sum;
      return sum + (PLAN_PRICE[sub.plan] || 0);
    }, 0);

    res.json({
      success: true,
      customer: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        nickname: user.nickname || "",
        mailClubSubscribed: !!mailClubSub,
        mailClubPlan: mailClubSub?.plan || null,
        mailClubEndDate: mailClubSub?.endDate || null,
        phone:
          user.phone ||
          orders[0]?.shippingInfo?.phone ||
          mailClubSub?.phone ||
          "",
        address:
          user.address ||
          orders[0]?.shippingInfo?.address ||
          mailClubSub?.address ||
          "",
        createdAt: user.createdAt,
        totalOrders: validOrders.length,
        totalSpent: totalSpent + mailClubSpent,
        orders,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
