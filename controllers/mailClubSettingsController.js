import MailClubSettings from "../models/MailClubSettings.js";
import { cacheGet, cacheSet, cacheDel } from "../utils/cache.js";

const CACHE_KEY = "mailclub-settings";

// Lấy settings (Public)
export const getSettings = async (req, res) => {
  try {
    // ⏱️ TTL ngắn (30s) vì có logic tự đóng theo thời gian (closeAt) — cần
    // đủ mới để user thấy trạng thái đóng/mở gần như ngay lập tức, nhưng
    // vẫn giảm được phần lớn tải DB do trang này được vào rất thường xuyên.
    const cached = cacheGet(CACHE_KEY);
    if (cached) return res.json({ success: true, settings: cached });

    let settings = await MailClubSettings.findOne();
    if (!settings) settings = await MailClubSettings.create({});

    // Tự động đóng nếu đã quá thời gian
    if (
      settings.isOpen &&
      settings.closeAt &&
      new Date() > new Date(settings.closeAt)
    ) {
      settings.isOpen = false;
      await settings.save();
    }

    cacheSet(CACHE_KEY, settings, 30_000);
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cập nhật settings (Admin)
export const updateSettings = async (req, res) => {
  try {
    const { isOpen, closeAt, openMessage, closedMessage } = req.body;

    let settings = await MailClubSettings.findOne();
    if (!settings) settings = new MailClubSettings();

    if (isOpen !== undefined) settings.isOpen = isOpen;
    if (closeAt !== undefined)
      settings.closeAt = closeAt ? new Date(closeAt) : null;
    if (openMessage !== undefined) settings.openMessage = openMessage;
    if (closedMessage !== undefined) settings.closedMessage = closedMessage;

    await settings.save();
    res.json({ success: true, settings });
    cacheDel(CACHE_KEY);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
