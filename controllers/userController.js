import User from "../models/User.js";
import Order from "../models/Order.js";
import MailClubSubscription from "../models/MailClubSubscription.js";
import { autoExpireSubscriptions } from "./mailClubController.js";

export const getCustomers = async (req, res) => {
  try {
    await autoExpireSubscriptions();
    const users = await User.find().select("-password").sort({ createdAt: -1 });

    // Lấy thêm thông tin đơn hàng cho mỗi user
    const customersWithStats = await Promise.all(
      users.map(async (user) => {
        const orders = await Order.find({ user: user._id });
        const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);

        const latestOrder = orders[0];

        // Tự động check MailClubSubscription theo email
        const mailClubSub = await MailClubSubscription.findOne({
          email: user.email,
          status: "active",
        });

        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          nickname: user.nickname || "",
          mailClubSubscribed: !!mailClubSub,
          mailClubPlan: mailClubSub?.plan || null,
          mailClubEndDate: mailClubSub?.endDate || null,
          phone: latestOrder?.shippingInfo?.phone || "",
          address: latestOrder?.shippingInfo?.address || "",
          createdAt: user.createdAt,
          totalOrders: orders.length,
          totalSpent,
        };
      }),
    );

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
    const user = await User.findById(id).select("-password");
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });

    const orders = await Order.find({ user: id }).sort({ createdAt: -1 });
    const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);

    const mailClubSub = await MailClubSubscription.findOne({
      email: user.email,
      status: "active",
    });

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
        createdAt: user.createdAt,
        totalOrders: orders.length,
        totalSpent,
        orders,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
