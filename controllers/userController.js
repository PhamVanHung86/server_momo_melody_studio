import User from "../models/User.js";
import Order from "../models/Order.js";
import MailClubSubscription from "../models/MailClubSubscription.js";
import { autoExpireSubscriptions } from "./mailClubController.js";

export const getCustomers = async (req, res) => {
  try {
    await autoExpireSubscriptions();

    // 1. Truy vấn lấy tất cả users (dùng .lean() để bỏ gánh nặng Mongoose Document)
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    if (users.length === 0) {
      return res.json({ success: true, customers: [] });
    }

    const userIds = users.map((u) => u._id);
    const emails = users.map((u) => u.email);

    // 2. Query duy nhất: Gom nhóm thống kê đơn hàng cho TOÀN BỘ users
    const orderStats = await Order.aggregate([
      { $match: { user: { $in: userIds } } },
      { $sort: { createdAt: -1 } }, // Sắp xếp đơn mới nhất lên đầu
      {
        $group: {
          _id: "$user",
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$total" },
          latestPhone: { $first: "$shippingInfo.phone" }, // Lấy phone đơn mới nhất
          latestAddress: { $first: "$shippingInfo.address" }, // Lấy address đơn mới nhất
        },
      },
    ]);

    // Tạo HashMap tra cứu O(1) cho đơn hàng
    const orderStatsMap = new Map(
      orderStats.map((stat) => [stat._id.toString(), stat]),
    );

    // 3. Query duy nhất: Lấy trạng thái MailClub cho TOÀN BỘ emails
    const activeSubs = await MailClubSubscription.find({
      email: { $in: emails },
      status: "active",
    }).lean();

    // Tạo HashMap tra cứu O(1) cho MailClub
    const mailClubMap = new Map(activeSubs.map((sub) => [sub.email, sub]));

    // 4. Ghép dữ liệu cực nhanh trong RAM
    const customersWithStats = users.map((user) => {
      const stats = orderStatsMap.get(user._id.toString()) || {};
      const mailClubSub = mailClubMap.get(user.email);

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        nickname: user.nickname || "",
        mailClubSubscribed: !!mailClubSub,
        mailClubPlan: mailClubSub?.plan || null,
        mailClubEndDate: mailClubSub?.endDate || null,
        phone: user.phone || stats.latestPhone || "",
        address: user.address || stats.latestAddress || "",
        createdAt: user.createdAt,
        totalOrders: stats.totalOrders || 0,
        totalSpent: stats.totalSpent || 0,
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
      { returnDocument: "after" }, // Thay new: true bằng returnDocument
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
    const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);

    const mailClubSub = await MailClubSubscription.findOne({
      email: user.email,
      status: "active",
    }).lean();

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
        phone: user.phone || orders[0]?.shippingInfo?.phone || "",
        address: user.address || orders[0]?.shippingInfo?.address || "",
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
