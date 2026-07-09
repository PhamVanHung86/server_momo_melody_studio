import ContactMessage from "../models/ContactMessage.js";
import { resend } from "../config/resend.js";

export const createContactMessage = async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res
        .status(400)
        .json({ message: "Vui lòng điền đầy đủ thông tin" });
    }

    const contactMsg = await ContactMessage.create({ name, email, message });

    // Gửi email thông báo cho admin
    try {
      await resend.emails.send({
        from: "momo's melody studio <onboarding@resend.dev>",
        to: "hung09058@gmail.com", // ← thay email của bạn
        subject: `📩 Tin nhắn mới từ ${name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #4A4A6A;">Tin nhắn liên hệ mới 🌸</h2>
            <p><strong>Tên:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Nội dung:</strong></p>
            <p style="background: #FFF0F5; padding: 16px; border-radius: 12px; color: #4A4A6A;">${message}</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Lỗi gửi email:", emailErr);
      // Không return lỗi — tin nhắn vẫn lưu DB thành công
    }

    res
      .status(201)
      .json({ success: true, message: "Đã gửi tin nhắn thành công" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin xem tất cả tin nhắn
export const getAllMessages = async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Đánh dấu đã đọc
export const markAsRead = async (req, res) => {
  try {
    const message = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true },
    );
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    await ContactMessage.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Đã xóa" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
