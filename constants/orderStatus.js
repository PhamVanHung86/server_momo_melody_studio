// 🎯 Nguồn sự thật DUY NHẤT cho trạng thái đơn hàng ở backend.
// Trước đây enum này bị lặp lại (gõ tay chuỗi tiếng Việt) ở nhiều nơi
// (Order.js, orderController.js, và cả admin/client tự định nghĩa lại) —
// dễ lệch chính tả (VD: "Đang xử lý" vs "Đang xử lí") gây bug âm thầm khi
// so sánh string. Import từ đây thay vì gõ lại chuỗi.
export const ORDER_STATUS = Object.freeze({
  PROCESSING: "Đang xử lý",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
});

export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS);

// Các trạng thái mà đơn hàng vẫn có thể được huỷ (còn ở giai đoạn có thể
// đảo ngược). Sau khi đơn "Đang giao"/"Đã giao" thì không tự huỷ được nữa,
// phải xử lý thủ công qua admin (đổi trực tiếp bằng updateOrderStatus).
export const CANCELLABLE_STATUSES = [
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.CONFIRMED,
];

export default ORDER_STATUS;
