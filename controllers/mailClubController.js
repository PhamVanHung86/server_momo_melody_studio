import MailClubSubscription from "../models/MailClubSubscription.js";
import { resend } from "../config/resend.js";
import Order from "../models/Order.js";
import MailClubSettings from "../models/MailClubSettings.js";

// Tính ngày hết hạn dựa theo gói
const calcEndDate = (startDate, plan) => {
  const end = new Date(startDate);
  if (plan === "monthly") end.setMonth(end.getMonth() + 1);
  if (plan === "quarterly") end.setMonth(end.getMonth() + 3);
  return end;
};

// ========== PUBLIC ==========

// Đăng ký Mail Club (Client)
// export const createSubscription = async (req, res) => {
//   try {
//     const { name, email, phone, plan, userId } = req.body;

//     // Kiểm tra đã đăng ký chưa
//     const existing = await MailClubSubscription.findOne({
//       email,
//       status: { $in: ["pending", "active"] },
//     });

//     if (existing) {
//       return res.status(400).json({
//         message:
//           existing.status === "pending"
//             ? "Email này đang chờ xác nhận thanh toán"
//             : "Email này đang có gói đăng ký active",
//       });
//     }

//     const sub = await MailClubSubscription.create({
//       name,
//       email,
//       phone,
//       plan,
//       userId: userId || null,
//     });

//     // Gửi email xác nhận cho khách
//     try {
//       await resend.emails.send({
//         from: "momo's melody studio <onboarding@resend.dev>",
//         to: email,
//         subject: "🎀 Đăng ký Mail Club thành công!",
//         html: `
//           <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
//             <h2 style="color: #4A4A6A;">Xin chào ${name}! 🌸</h2>
//             <p>Bạn đã đăng ký <strong>Mail Club ${plan === "monthly" ? "Tháng" : "Quý"}</strong> thành công!</p>
//             <div style="background: #FFF0F5; padding: 16px; border-radius: 12px; margin: 16px 0;">
//               <p style="color: #4A4A6A; margin: 0;"><strong>Thông tin chuyển khoản:</strong></p>
//               <p style="color: #4A4A6A;">Ngân hàng: Vietcombank</p>
//               <p style="color: #4A4A6A;">Số tài khoản: 1234567890</p>
//               <p style="color: #4A4A6A;">Chủ tài khoản: NGUYEN VAN A</p>
//               <p style="color: #FFB7C5;"><strong>Nội dung CK: MAILCLUB ${email}</strong></p>
//             </div>
//             <p>Sau khi chuyển khoản, chúng mình sẽ xác nhận trong vòng 24h nhé! 🩷</p>
//           </div>
//         `,
//       });
//     } catch (emailErr) {
//       console.error("Lỗi gửi email:", emailErr);
//     }

//     res.status(201).json({ success: true, subscription: sub });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// Xem trạng thái sub của user hiện tại
export const getMySubscription = async (req, res) => {
  try {
    const User = (await import("../models/User.js")).default;
    const user = await User.findById(req.user.id);

    const sub = await MailClubSubscription.findOne({
      $or: [{ userId: req.user.id }, { email: user.email }],
      status: { $in: ["pending", "active"] },
    }).sort({ createdAt: -1 });

    res.json({ success: true, subscription: sub });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
        // Sắp hết hạn trong 7 ngày
        const now = new Date();
        const in7Days = new Date();
        in7Days.setDate(in7Days.getDate() + 7);
        query = { status: "active", endDate: { $gte: now, $lte: in7Days } };
      } else {
        query.status = status;
      }
    }

    const subs = await MailClubSubscription.find(query).sort({ createdAt: -1 });
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
      note: note || "Xác nhận lần đầu",
    });

    await sub.save();

    // Gửi email thông báo cho khách
    try {
      await resend.emails.send({
        from: "momo's melody studio <onboarding@resend.dev>",
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
            <p>Hộp quà của bạn sẽ sớm được gửi đi nhé! 🌸</p>
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

// Gia hạn subscription
export const renewSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { plan, note } = req.body;

    const sub = await MailClubSubscription.findById(id);
    if (!sub) return res.status(404).json({ message: "Không tìm thấy" });

    // Nếu còn hạn thì tính từ ngày hết hạn cũ, nếu hết hạn thì tính từ hôm nay
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

    // Email thông báo gia hạn
    try {
      await resend.emails.send({
        from: "momo's melody studio <onboarding@resend.dev>",
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

// Gửi email nhắc gia hạn hàng loạt (sắp hết hạn)
export const sendRenewalReminders = async (req, res) => {
  try {
    const now = new Date();
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);

    const expiringSubs = await MailClubSubscription.find({
      status: "active",
      endDate: { $gte: now, $lte: in7Days },
    });

    const results = await Promise.allSettled(
      expiringSubs.map((sub) =>
        resend.emails.send({
          from: "momo's melody studio <onboarding@resend.dev>",
          to: sub.email,
          subject: "⏰ Mail Club sắp hết hạn!",
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #4A4A6A;">Xin chào ${sub.name}! 🩷</h2>
              <p>Mail Club của bạn sẽ hết hạn vào <strong style="color: #FFB7C5;">${new Date(sub.endDate).toLocaleDateString("vi-VN")}</strong>.</p>
              <p>Để tiếp tục nhận hộp quà handmade mỗi ${sub.plan === "monthly" ? "tháng" : "quý"}, hãy gia hạn sớm nhé!</p>
              <div style="background: #FFF0F5; padding: 16px; border-radius: 12px; margin: 16px 0;">
                <p style="color: #4A4A6A;"><strong>Thông tin chuyển khoản:</strong></p>
                <p style="color: #4A4A6A;">Ngân hàng: Vietcombank</p>
                <p style="color: #4A4A6A;">Số tài khoản: 1234567890</p>
                <p style="color: #FFB7C5;"><strong>Nội dung CK: RENEW ${sub.email}</strong></p>
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
      new: true,
    });
    res.json({ success: true, subscription: sub });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Thêm vào cuối file:
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
      new: true,
    });
    res.json({ success: true, subscription: sub });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Thêm hàm này:
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

export const createSubscription = async (req, res) => {
  try {
    const settings = await MailClubSettings.findOne();
    if (!settings?.isOpen) {
      return res.status(400).json({ message: "Form đăng ký hiện đã đóng" });
    }
    if (settings.closeAt && new Date() > new Date(settings.closeAt)) {
      await MailClubSettings.findOneAndUpdate({}, { isOpen: false });
      return res.status(400).json({ message: "Form đăng ký đã hết thời gian" });
    }
    const { name, email, phone, plan, userId } = req.body;
    // Kiểm tra đã đăng ký chưa
    const existing = await MailClubSubscription.findOne({
      email,
      status: { $in: ["pending", "active"] },
    });

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

    // Tạo subscription
    const sub = await MailClubSubscription.create({
      name,
      email,
      phone,
      plan,
      userId: userId || null,
    });

    // Tạo order tương ứng
    const orderData = {
      items: [
        {
          product: sub._id.toString(),
          name: PLAN_LABEL[plan],
          image: "",
          price,
          quantity: 1,
        },
      ],
      shippingInfo: {
        name,
        phone,
        address: "Mail Club — Giao qua bưu điện",
        note: `Đăng ký ${PLAN_LABEL[plan]}`,
      },
      paymentMethod: "transfer",
      subtotal: price,
      deliveryFee: 0,
      total: price,
      status: "Đang xử lý",
    };

    // Nếu có userId thì gắn vào order
    if (userId) {
      orderData.user = userId;
      await Order.create(orderData);
    } else {
      // Khách chưa có tài khoản → lưu thêm field email vào order
      await Order.create({
        ...orderData,
        user: null, // tạm null
        guestEmail: email, // field mới
      });
    }

    // Gửi email xác nhận
    try {
      await resend.emails.send({
        from: "momo's melody studio <onboarding@resend.dev>",
        to: email,
        subject: "🎀 Đăng ký Mail Club thành công!",
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #4A4A6A;">Xin chào ${name}! 🌸</h2>
            <p>Bạn đã đăng ký <strong>${PLAN_LABEL[plan]}</strong> thành công!</p>
            <div style="background: #FFF0F5; padding: 16px; border-radius: 12px; margin: 16px 0;">
              <p style="color: #4A4A6A; margin: 0;"><strong>Thông tin chuyển khoản:</strong></p>
              <p style="color: #4A4A6A;">Ngân hàng: TP Bank</p>
              <p style="color: #4A4A6A;">Số tài khoản:  24182951170</p>
              <p style="color: #4A4A6A;">Chủ tài khoản: TRAN THI NGOC ANH</p>
              <p style="color: #FFB7C5;"><strong>Nội dung CK: TÊN - SĐT</strong></p>
              <p style="color: #4A4A6A; margin-top: 8px;"><strong>Số tiền: ${price.toLocaleString()} đ</strong></p>
            </div>
            <p>Sau khi chuyển khoản, chúng mình sẽ xác nhận trong vòng 24h nhé! 🩷</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Lỗi gửi email:", emailErr);
    }

    res.status(201).json({ success: true, subscription: sub });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
