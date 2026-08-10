// Cache in-memory đơn giản (TTL) cho dữ liệu ít thay đổi nhưng được đọc
// nhiều (banner, cấu hình mail club...). Không cần Redis ở quy mô hiện tại
// của dự án — 1 instance server thì Map trong RAM là đủ. Nếu sau này scale
// ra nhiều instance (load balancer), thay bằng Redis là đủ vì interface
// (get/set/del) giữ nguyên, chỉ cần đổi phần implementation.
const store = new Map();

/** Lấy dữ liệu cache, trả về null nếu hết hạn hoặc chưa có */
export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/** Lưu dữ liệu vào cache, ttlMs mặc định 60 giây */
export function cacheSet(key, value, ttlMs = 60_000) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Xoá 1 key hoặc toàn bộ cache (dùng khi admin cập nhật dữ liệu) */
export function cacheDel(key) {
  if (key) store.delete(key);
  else store.clear();
}

export default { cacheGet, cacheSet, cacheDel };
