import mongoose from "mongoose";
import User from "../models/User.js";
import MailClubSubscription from "../models/MailClubSubscription.js";
import MailClubSettings from "../models/MailClubSettings.js";
import Order from "../models/Order.js";
import { resend } from "../config/resend.js";
import { logError } from "../config/logger.js";

// Helper: Tính ngày hết hạn dựa theo gói
const calcEndDate = (startDate, plan) => {
  const end = new Date(startDate);
  if (plan === "monthly") end.setMonth(end.getMonth() + 1);
  if (plan === "quarterly") end.setMonth(end.getMonth() + 3);
  return end;
};

// Kích hoạt 1 subscription — dùng chung cho confirmPayment (xác nhận từ trang
// Mail Club) và confirmOrder bên orderController (xác nhận từ trang Orders)
// để tránh lặp code + đảm bảo 2 nơi luôn đồng bộ cùng 1 logic
export const activateSubscription = async (sub, note = "Xác nhận lần đầu") => {
  const startDate = new Date();
  const endDate = calcEndDate(startDate, sub.plan);

  sub.status = "active";
  sub.startDate = startDate;
  sub.endDate = endDate;
  if (note) sub.adminNote = note;

  sub.renewalHistory.push({
    renewedAt: new Date(),
    plan: sub.plan,
    startDate,
    endDate,
    note,
  });

  await sub.save();

  try {
    await resend.emails.send({
      from: "momo's melody studio <shop@momomeomeow.com>",
      to: sub.email,
      subject: "✅ Mail Club đã được kích hoạt!",
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #4A4A6A;">Xin chào ${sub.name}! 🎀</h2>
          <p>Mail Club của bạn đã được kích hoạt thành công!</p>
          <div style="background: #FFF0F5; padding: 16px; border-radius: 12px; margin: 16px 0;">
            <p style="color: #4A4A6A;"><strong>Gói:</strong> ${sub.plan === "monthly" ? "Tháng" : "Quý"}</p>
            <p style="color: #4A4A6A;"><strong>Bắt đầu:</strong> ${startDate.toLocaleDateString("vi-VN")}</p>
            <p style="color: #FFB7C5;"><strong>Hết hạn:</strong> ${endDate.toLocaleDateString("vi-VN")}</p>
          </div>
          <p>Mail club của bạn sẽ sớm được gửi đi nhé! 🌸</p>
        </div>
      `,
    });
  } catch (emailErr) {
    console.error("Lỗi gửi email:", emailErr);
  }

  return sub;
};

// ========== PUBLIC ==========

// Xem trạng thái sub của user hiện tại
export const getMySubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("email").lean();
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    const sub = await MailClubSubscription.findOne({
      $or: [{ userId: req.user.id }, { email: user.email }],
      status: { $in: ["pending", "active"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, subscription: sub });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🚀 Đăng ký Mail Club (Client) - Đã áp dụng ACID Transaction
export const createSubscription = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const settings = await MailClubSettings.findOne().lean();
    if (!settings?.isOpen) {
      return res.status(400).json({ message: "Form đăng ký hiện đã đóng" });
    }

    if (settings.closeAt && new Date() > new Date(settings.closeAt)) {
      await MailClubSettings.findOneAndUpdate({}, { isOpen: false });
      return res.status(400).json({ message: "Form đăng ký đã hết thời gian" });
    }

    const { name, email, phone, plan, userId, address } = req.body;

    if (!name || !email || !phone || !plan) {
      return res
        .status(400)
        .json({ message: "Vui lòng điền đầy đủ thông tin" });
    }

    // Kiểm tra đã đăng ký chưa
    const existing = await MailClubSubscription.findOne({
      email,
      status: { $in: ["pending", "active"] },
    }).lean();

    if (existing) {
      return res.status(400).json({
        message:
          existing.status === "pending"
            ? "Email này đang chờ xác nhận thanh toán"
            : "Email này đang có gói đăng ký active",
      });
    }

    const PLAN_PRICE = { monthly: 135000, quarterly: 364500 };
    const PLAN_LABEL = {
      monthly: "Mail Club Tháng 🌸",
      quarterly: "Mail Club Quý 🎀",
    };
    const price = PLAN_PRICE[plan] || 135000;

    let sub, order;

    // 🔒 ACID Transaction: Đảm bảo Subscription & Order được tạo VÀ liên kết
    // với nhau thành công cùng lúc — nếu 1 bước lỗi thì rollback hết, không
    // bao giờ để lọt 1 cặp record bị "mồ côi" (có sub mà không có order liên kết hoặc ngược lại)
    await session.withTransaction(async () => {
      const createdSubs = await MailClubSubscription.create(
        [
          {
            name,
            email,
            phone,
            address,
            plan,
            userId: userId || null,
          },
        ],
        { session },
      );
      sub = createdSubs[0];

      const orderData = {
        items: [
          {
            product: sub._id.toString(),
            name: PLAN_LABEL[plan] || "Mail Club",
            image: "",
            price,
            quantity: 1,
          },
        ],
        shippingInfo: {
          name,
          phone,
          address: address ? `${address} (Mail Club)` : "Mail Club",
          note: `Đăng ký ${PLAN_LABEL[plan] || "Mail Club"}`,
        },
        paymentMethod: "transfer",
        subtotal: price,
        deliveryFee: 0,
        total: price,
        status: "Đang xử lý",
        user: userId || null,
        guestEmail: userId ? "" : email,
        // Liên kết chiều Order -> Subscription ngay lúc tạo
        mailClubSubscription: sub._id,
      };

      const createdOrders = await Order.create([orderData], { session });
      order = createdOrders[0];

      // Liên kết chiều Subscription -> Order
      sub.order = order._id;
      await sub.save({ session });
    });

    // 👤 Đồng bộ tên/SĐT/địa chỉ vào hồ sơ User — cùng logic với
    // createOrder bên orderController.js, để hồ sơ luôn được cập nhật
    // dù khách điền thông tin qua đơn hàng thường hay qua form Mail Club
    if (userId) {
      try {
        const profileUpdate = {};
        if (name?.trim()) profileUpdate.name = name.trim();
        if (phone?.trim()) profileUpdate.phone = phone.trim();
        if (address?.trim()) profileUpdate.address = address.trim();

        if (Object.keys(profileUpdate).length > 0) {
          await User.findByIdAndUpdate(userId, profileUpdate);
        }
      } catch (err) {
        logError(err, { where: "createSubscription -> sync profile" });
      }
    }

    // 📧 Gửi email xác nhận (Nằm ngoài Transaction để tránh làm gián đoạn DB)
    try {
      await resend.emails.send({
        from: "momo's melody studio <shop@momomeomeow.com>",
        to: email,
        subject: "🎀 Đăng ký Mail Club thành công!",
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #4A4A6A;">Xin chào ${name}! 🌸</h2>
            <p>Bạn đã đăng ký <strong>${PLAN_LABEL[plan]}</strong> thành công!</p>
            <div style="background: #FFF0F5; padding: 16px; border-radius: 12px; margin: 16px 0;">
              <p style="color: #4A4A6A; margin: 0;"><strong>Thông tin chuyển khoản:</strong></p>
              <p style="color: #4A4A6A;">Ngân hàng: TP Bank</p>
              <p style="color: #4A4A6A;">Số tài khoản: 24182951170</p>
              <p style="color: #4A4A6A;">Chủ tài khoản: TRAN THI NGOC ANH</p>
              <p style="color: #FFB7C5;"><strong>Nội dung CK: TÊN - SĐT</strong></p>
              <p style="color: #4A4A6A; margin-top: 8px;"><strong>Số tiền: ${price.toLocaleString()} đ</strong></p>
            </div>
            <p>Sau khi chuyển khoản, chúng mình sẽ xác nhận trong vòng 24h nhé! 🩷</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Lỗi gửi email xác nhận Mail Club:", emailErr);
    }

    // 📩 Gửi email thông báo cho admin mỗi khi có đăng ký Mail Club mới
    try {
      await resend.emails.send({
        from: "momo's melody studio <shop@momomeomeow.com>",
        to: process.env.ADMIN_EMAIL,
        subject: `🎀 Đăng ký Mail Club mới — ${PLAN_LABEL[plan] || "Mail Club"}`,
        html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #4A4A6A;">Có đăng ký Mail Club mới! 🌸</h2>
        <p><strong>Khách hàng:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>SĐT:</strong> ${phone}</p>
        ${address ? `<p><strong>Địa chỉ:</strong> ${address}</p>` : ""}
        <p><strong>Gói:</strong> ${PLAN_LABEL[plan] || "Mail Club"}</p>
        <p><strong>Số tiền cần thu:</strong> ${price.toLocaleString("vi-VN")}đ</p>
        <p style="color: #FFB7C5;"><strong>⏳ Đang chờ xác nhận chuyển khoản</strong></p>

        <!-- 🎯 NÚT TRUY CẬP TRANG ADMIN -->
        <div style="margin-top: 28px; text-align: center;">
          <a href="https://adminmomomelody.netlify.app/"
             target="_blank"
             style="display: inline-block; background-color: #8B98E3; color: #ffffff; padding: 12px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 14px; box-shadow: 0 4px 10px rgba(139, 152, 227, 0.3);">
            👉 Vào trang Admin xác nhận thanh toán
          </a>
        </div>
      </div>
    `,
      });
    } catch (err) {
      logError(err, { where: "createSubscription -> notify admin email" });
    }

    res.status(201).json({ success: true, subscription: sub, order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// ========== ADMIN ==========

// Lấy tất cả subscriptions
export const getAllSubscriptions = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};

    if (status && status !== "all") {
      if (status === "expiring") {
        const now = new Date();
        const in7Days = new Date();
        in7Days.setDate(in7Days.getDate() + 7);
        query = { status: "active", endDate: { $gte: now, $lte: in7Days } };
      } else {
        query.status = status;
      }
    }

    const subs = await MailClubSubscription.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, subscriptions: subs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Xác nhận thanh toán → active
export const confirmPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const sub = await MailClubSubscription.findById(id);
    if (!sub) return res.status(404).json({ message: "Không tìm thấy" });

    await activateSubscription(sub, note || "Xác nhận lần đầu");

    // Đồng bộ: nếu subscription này có Order liên kết đang chờ xác nhận
    // (khách đã tạo qua form đăng ký) thì xác nhận luôn đơn đó
    if (sub.order) {
      await Order.findOneAndUpdate(
        { _id: sub.order, status: "Đang xử lý" },
        { status: "Đã xác nhận", confirmedAt: new Date() },
      );
    }

    res.json({ success: true, subscription: sub });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Gia hạn subscription
export const renewSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { plan, note } = req.body;

    const sub = await MailClubSubscription.findById(id);
    if (!sub) return res.status(404).json({ message: "Không tìm thấy" });

    const startDate =
      sub.endDate && new Date(sub.endDate) > new Date()
        ? new Date(sub.endDate)
        : new Date();
    const endDate = calcEndDate(startDate, plan || sub.plan);

    sub.status = "active";
    sub.plan = plan || sub.plan;
    sub.startDate = startDate;
    sub.endDate = endDate;
    if (note) sub.adminNote = note;

    sub.renewalHistory.push({
      renewedAt: new Date(),
      plan: plan || sub.plan,
      startDate,
      endDate,
      note: note || "Gia hạn",
    });

    await sub.save();

    try {
      await resend.emails.send({
        from: "momo's melody studio <shop@momomeomeow.com>",
        to: sub.email,
        subject: "🔄 Mail Club đã được gia hạn!",
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #4A4A6A;">Xin chào ${sub.name}! 🌸</h2>
            <p>Mail Club của bạn đã được gia hạn thành công!</p>
            <div style="background: #FFF0F5; padding: 16px; border-radius: 12px; margin: 16px 0;">
              <p style="color: #4A4A6A;"><strong>Gói mới:</strong> ${(plan || sub.plan) === "monthly" ? "Tháng" : "Quý"}</p>
              <p style="color: #4A4A6A;"><strong>Bắt đầu:</strong> ${startDate.toLocaleDateString("vi-VN")}</p>
              <p style="color: #FFB7C5;"><strong>Hết hạn:</strong> ${endDate.toLocaleDateString("vi-VN")}</p>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Lỗi gửi email:", emailErr);
    }

    res.json({ success: true, subscription: sub });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Gửi email nhắc gia hạn hàng loạt
export const sendRenewalReminders = async (req, res) => {
  try {
    const now = new Date();
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);

    const expiringSubs = await MailClubSubscription.find({
      status: "active",
      endDate: { $gte: now, $lte: in7Days },
    }).lean();

    const results = await Promise.allSettled(
      expiringSubs.map((sub) =>
        resend.emails.send({
          from: "momo's melody studio <shop@momomeomeow.com>",
          to: sub.email,
          subject: "⏰ Mail Club sắp hết hạn!",
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #4A4A6A;">Xin chào ${sub.name}! 🩷</h2>
              <p>Mail Club của bạn sẽ hết hạn vào <strong style="color: #FFB7C5;">${new Date(sub.endDate).toLocaleDateString("vi-VN")}</strong>.</p>
              <p>Để tiếp tục nhận Mail club mỗi ${sub.plan === "monthly" ? "tháng" : "quý"}, hãy gia hạn sớm nhé!</p>
              <div style="background: #FFF0F5; padding: 16px; border-radius: 12px; margin: 16px 0;">
                <p style="color: #4A4A6A;"><strong>Thông tin chuyển khoản:</strong></p>
                <p style="color: #4A4A6A;">Ngân hàng: TP Bank</p>
                <p style="color: #4A4A6A;">Số tài khoản: 24182951170</p>
                <p style="color: #FFB7C5;"><strong>Nội dung CK: Tháng mới + SĐT</strong></p>
              </div>
            </div>
          `,
        }),
      ),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    res.json({
      success: true,
      message: `Đã gửi ${sent}/${expiringSubs.length} email nhắc gia hạn`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cập nhật ghi chú + hủy
export const updateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const sub = await MailClubSubscription.findByIdAndUpdate(id, req.body, {
      returnDocument: "after",
    }).lean();
    res.json({ success: true, subscription: sub });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const adminCreateSubscription = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      address,
      plan,
      status,
      startDate,
      endDate,
      adminNote,
    } = req.body;

    const sub = await MailClubSubscription.create({
      name,
      email,
      phone,
      address,
      plan,
      status: status || "active",
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      adminNote: adminNote || "",
      renewalHistory: startDate
        ? [
            {
              renewedAt: new Date(),
              plan,
              startDate: new Date(startDate),
              endDate: new Date(endDate),
              note: "Thêm thủ công bởi admin",
            },
          ]
        : [],
    });

    res.status(201).json({ success: true, subscription: sub });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const adminUpdateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      phone,
      address,
      plan,
      status,
      startDate,
      endDate,
      adminNote,
    } = req.body;

    const updateData = {
      name,
      email,
      phone,
      address,
      plan,
      status,
      adminNote,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    };

    const sub = await MailClubSubscription.findByIdAndUpdate(id, updateData, {
      returnDocument: "after",
    }).lean();

    res.json({ success: true, subscription: sub });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const autoExpireSubscriptions = async () => {
  try {
    const result = await MailClubSubscription.updateMany(
      {
        status: "active",
        endDate: { $lt: new Date() },
      },
      { $set: { status: "expired" } },
    );
    if (result.modifiedCount > 0) {
      console.log(`✅ Auto expired ${result.modifiedCount} subscriptions`);
    }
  } catch (error) {
    console.error("Auto expire error:", error);
  }
};

export const sendCustomEmail = async (req, res) => {
  try {
    const {
      recipientType,
      specificIds,
      subject,
      message,
      buttonText,
      buttonLink,
    } = req.body;

    let subscribers = [];

    if (recipientType === "all") {
      subscribers = await MailClubSubscription.find({
        status: { $in: ["active", "expired"] },
      }).lean();
    } else if (recipientType === "active") {
      subscribers = await MailClubSubscription.find({
        status: "active",
      }).lean();
    } else if (recipientType === "specific") {
      subscribers = await MailClubSubscription.find({
        _id: { $in: specificIds },
      }).lean();
    }

    if (subscribers.length === 0) {
      return res.status(400).json({ message: "Không có người nhận nào" });
    }

    const results = await Promise.allSettled(
      subscribers.map((sub) =>
        resend.emails.send({
          from: "momo's melody studio <shop@momomeomeow.com>",
          to: sub.email,
          subject,
          html: `
            <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 0; background: #FFFAF5;">
              <div style="background: linear-gradient(135deg, #FFD6E0, #E8E4F5); padding: 32px 24px; text-align: center; border-radius: 16px 16px 0 0;">
                <h1 style="font-family: Georgia, serif; color: #4A4A6A; font-size: 28px; font-weight: normal; margin: 0;">
                  momo's melody studio 🌸
                </h1>
              </div>

              <div style="background: white; padding: 32px 24px;">
                <p style="color: #4A4A6A; font-size: 15px; margin: 0 0 8px;">Xin chào ${sub.name}! 🩷</p>
                <div style="color: #4A4A6A; font-size: 14px; line-height: 1.8; white-space: pre-wrap; margin-top: 16px;">
                  ${message}
                </div>

                ${
                  buttonText && buttonLink
                    ? `
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="${buttonLink}"
                      style="background: #FFB7C5; color: white; padding: 12px 32px; border-radius: 50px; text-decoration: none; font-size: 14px; font-weight: 600;">
                      ${buttonText}
                    </a>
                  </div>
                `
                    : ""
                }
              </div>

              <div style="background: #FFF0F5; padding: 16px 24px; text-align: center; border-radius: 0 0 16px 16px;">
                <p style="color: #4A4A6A; font-size: 11px; opacity: 0.5; margin: 0;">
                  momo's melody studio · Góc Sổ Tay, Tầng Mơ Mộng 🎧
                </p>
              </div>
            </div>
          `,
        }),
      ),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    res.json({
      success: true,
      message: `Đã gửi ${sent}/${subscribers.length} email${failed > 0 ? `, ${failed} thất bại` : ""}`,
      sent,
      failed,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🚀 Thống kê Mail Club cho Dashboard (Admin) - Đã tối ưu 100% Aggregation
export const getMailClubStats = async (req, res) => {
  try {
    const PLAN_PRICE = { monthly: 135000, quarterly: 364500 };
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [thisMonthAgg, activeMembers, planCounts] = await Promise.all([
      MailClubSubscription.aggregate([
        {
          $match: {
            status: { $in: ["active", "expired"] },
            startDate: { $gte: monthStart },
          },
        },
        {
          $group: {
            _id: "$plan",
            count: { $sum: 1 },
          },
        },
      ]),
      MailClubSubscription.countDocuments({ status: "active" }),
      MailClubSubscription.aggregate([
        { $match: { status: "active" } },
        { $group: { _id: "$plan", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]),
    ]);

    const monthlyRevenue = thisMonthAgg.reduce(
      (sum, item) => sum + (PLAN_PRICE[item._id] || 0) * item.count,
      0,
    );

    const popularPlan =
      planCounts.length > 0
        ? planCounts[0]._id === "monthly"
          ? "Gói Tháng"
          : "Gói Quý"
        : "Chưa có";

    res.json({
      success: true,
      stats: { monthlyRevenue, activeMembers, popularPlan },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
