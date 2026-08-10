import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

// 🔑 Access + Refresh token
// -----------------------------------------------------------------------
// Trước đây chỉ có 1 JWT sống 7 ngày, không thể thu hồi trước hạn — nếu
// token bị lộ (XSS, máy công cộng...) thì kẻ tấn công dùng được suốt 7
// ngày. Giờ tách thành:
//   - Access token: sống ngắn (30 phút), dùng để gọi API, KHÔNG lưu ở DB
//     (stateless như JWT thường).
//   - Refresh token: sống dài (30 ngày), CHỈ dùng để xin access token mới
//     qua endpoint /api/auth/refresh. Hash (sha256) của nó được lưu ở DB
//     (User.refreshTokens) để có thể revoke (logout, đổi mật khẩu...).
//     Không lưu token gốc — nếu DB bị lộ, kẻ tấn công vẫn không có token
//     dùng được (giống cách lưu password, nhưng dùng sha256 vì đây là
//     chuỗi ngẫu nhiên entropy cao, không cần bcrypt chậm như password).
const ACCESS_TOKEN_TTL = "30m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày
const MAX_REFRESH_TOKENS_PER_USER = 5; // giới hạn số thiết bị đăng nhập cùng lúc

export const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });

const generateRefreshToken = (id) =>
  jwt.sign({ id, type: "refresh" }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "30d",
  });

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

/**
 * Tạo cặp access + refresh token cho user, lưu hash refresh token vào DB.
 * Dùng chung cho register/login/google callback.
 */
export const issueTokens = async (user) => {
  const accessToken = generateToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  // Dọn token hết hạn + giới hạn số thiết bị, rồi thêm token mới
  user.refreshTokens = (user.refreshTokens || []).filter(
    (t) => t.expiresAt > new Date(),
  );
  if (user.refreshTokens.length >= MAX_REFRESH_TOKENS_PER_USER) {
    user.refreshTokens.shift(); // bỏ token cũ nhất nếu vượt giới hạn
  }
  user.refreshTokens.push({ tokenHash, expiresAt });
  await user.save();

  return { accessToken, refreshToken };
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
    const { accessToken, refreshToken } = await issueTokens(user);

    res.status(201).json({
      success: true,
      accessToken,
      refreshToken,
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

    const { accessToken, refreshToken } = await issueTokens(user);

    res.json({
      success: true,
      accessToken,
      refreshToken,
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

// Làm mới access token bằng refresh token
// Áp dụng "rotation": mỗi lần refresh sẽ vô hiệu hoá refresh token cũ và
// phát hành refresh token mới — nếu 1 refresh token bị dùng lại sau khi đã
// rotate (dấu hiệu bị đánh cắp), nó sẽ không còn hợp lệ trong DB nữa.
export const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(401).json({ message: "Thiếu refresh token" });

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res
        .status(401)
        .json({ message: "Refresh token không hợp lệ hoặc đã hết hạn" });
    }

    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: "Không tìm thấy user" });

    const tokenHash = hashToken(refreshToken);
    const matched = (user.refreshTokens || []).find(
      (t) => t.tokenHash === tokenHash && t.expiresAt > new Date(),
    );
    if (!matched) {
      return res
        .status(401)
        .json({ message: "Refresh token không hợp lệ hoặc đã bị thu hồi" });
    }

    // Rotate: xoá token cũ, phát hành cặp token mới
    user.refreshTokens = user.refreshTokens.filter(
      (t) => t.tokenHash !== tokenHash,
    );
    await user.save();

    const { accessToken, refreshToken: newRefreshToken } =
      await issueTokens(user);

    res.json({ success: true, accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Đăng xuất
// Thu hồi refresh token được gửi lên (nếu có) để nó không dùng lại được
// nữa, kể cả khi chưa hết hạn 30 ngày. Client tự xoá token khỏi localStorage.
export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken && req.user?.id) {
      const tokenHash = hashToken(refreshToken);
      await User.findByIdAndUpdate(req.user.id, {
        $pull: { refreshTokens: { tokenHash } },
      });
    }
    res.json({ success: true, message: "Đăng xuất thành công" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
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
