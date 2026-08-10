// Escape các ký tự đặc biệt của regex trước khi đưa input người dùng vào
// $regex của MongoDB — tránh lỗi cú pháp hoặc query bị chậm bất thường
// (ReDoS nhẹ) nếu ai đó gõ ký tự như "(a+)+", ".*", "|"... vào ô tìm kiếm.
export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default escapeRegex;
