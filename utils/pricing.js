import FlashSale from "../models/FlashSale.js";

/**
 * Trả về Map<productId(string), discountPercent> của Flash Sale đang active
 * (nếu có). Dùng để tính giá bán thực tế server-side khi tạo đơn hàng —
 * TRƯỚC ĐÂY createOrder tính subtotal thẳng từ `product.price` (giá gốc),
 * bỏ qua hoàn toàn Flash Sale đang chạy, trong khi FE lại hiển thị và gửi
 * lên giá đã giảm. Kết quả: khách thấy giá sale nhưng số tiền ghi nhận
 * trong đơn (và khi đối soát COD/chuyển khoản) lại là giá gốc cao hơn.
 *
 * Luôn tính lại ở BACKEND (không tin giá client gửi lên) để vừa fix đúng
 * business logic, vừa không mở lỗ hổng cho client tự ý gửi giá tuỳ ý.
 */
export async function getActiveFlashSaleDiscountMap() {
  const now = new Date();
  const flashSale = await FlashSale.findOne({
    active: true,
    startTime: { $lte: now },
    endTime: { $gte: now },
  }).select("discountPercent products");

  const map = new Map();
  if (flashSale) {
    for (const productId of flashSale.products) {
      map.set(productId.toString(), flashSale.discountPercent);
    }
  }
  return map;
}

/**
 * Tính giá bán thực tế của 1 sản phẩm tại thời điểm hiện tại, có áp dụng
 * Flash Sale nếu sản phẩm đang nằm trong chương trình.
 */
export function applyFlashSalePrice(basePrice, productId, discountMap) {
  const discountPercent = discountMap.get(productId.toString());
  if (!discountPercent) return basePrice;
  return Math.round(basePrice * (1 - discountPercent / 100));
}
