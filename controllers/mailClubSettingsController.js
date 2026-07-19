import MailClubSettings from "../models/MailClubSettings.js";

// Lấy settings (Public)
export const getSettings = async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
