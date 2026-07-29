import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const isProd = process.env.NODE_ENV === "production";

export const setCookie = (res, token) => {
  res.cookie("token", token, {
    httpOnly: true,
    // 🔑 Production: client/admin thường nằm ở domain khác server (VD:
    // Vercel <-> Render) → cookie là "cross-site" nên PHẢI dùng
    // sameSite: "none" kèm secure: true (secure bắt buộc khi dùng "none",
    // và chỉ hoạt động qua HTTPS). Dev local (cùng localhost, chạy HTTP)
    // thì giữ "lax" cho đơn giản, không cần secure.
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

// Đăng ký
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res
        .status(400)
        .json({ message: "Vui lòng điền đầy đủ thông tin" });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "Email đã được sử dụng" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });

    const token = generateToken(user._id);
    setCookie(res, token);

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        hasPassword: !!user.password,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Đăng nhập
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Email không tồn tại" });

    if (!user.password)
      return res
        .status(400)
        .json({ message: "Tài khoản này dùng Google đăng nhập" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Mật khẩu không đúng" });

    const token = generateToken(user._id);
    setCookie(res, token);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        address: user.address || "",
        avatar: user.avatar,
        role: user.role,
        hasPassword: !!user.password,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Đăng xuất
export const logout = async (req, res) => {
  // ⚠️ clearCookie cần đúng options (secure/sameSite) như lúc set,
  // nếu không trình duyệt sẽ không nhận diện đúng cookie để xoá.
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });
  res.json({ success: true, message: "Đăng xuất thành công" });
};

// Lấy thông tin user hiện tại (Tối ưu 1 lần query DB)
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

    const hasPassword = !!user.password;
    const userObj = user.toObject();
    delete userObj.password;

    res.json({ success: true, user: { ...userObj, hasPassword } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cập nhật thông tin cá nhân (Sửa deprecation warning)
export const updateProfile = async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const updateData = { name, phone, address };
    if (req.file) updateData.avatar = req.file.path;

    const user = await User.findByIdAndUpdate(req.user.id, updateData, {
      returnDocument: "after", // Đã thay new: true
      runValidators: true,
    }).select("-password");

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Thiết lập/Đổi mật khẩu (Đã thêm await & validate newPassword)
export const setPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: "Vui lòng nhập mật khẩu mới" });
    }

    // ✅ Đã thêm await
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

    // Nếu đã có password → yêu cầu nhập password cũ để xác nhận
    if (user.password) {
      if (!currentPassword) {
        return res
          .status(400)
          .json({ message: "Vui lòng nhập mật khẩu hiện tại" });
      }
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        return res
          .status(400)
          .json({ message: "Mật khẩu hiện tại không đúng" });
      }
    }

    // Set password mới
    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    res.json({ success: true, message: "Đã cập nhật mật khẩu thành công" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
