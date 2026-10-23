import { createHash, timingSafeEqual } from 'node:crypto';

/* Đã bật Blob và đặt mật khẩu quản lý chưa */
export function configured() {
  return !!((process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) && process.env.ADMIN_PASSWORD);
}

function digest(s) {
  return createHash('sha256').update(String(s)).digest();
}

/* Kiểm tra mật khẩu quản lý gửi kèm trong header */
export function isAdmin(req) {
  const got = req.headers['x-admin-password'];
  if (typeof got !== 'string' || !got) return false;
  return timingSafeEqual(digest(got), digest(process.env.ADMIN_PASSWORD || ''));
}

/* Đọc nội dung gửi lên (dạng nhị phân) */
export async function readBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

/* Chỉ nhận địa chỉ file nằm trong kho Blob của mình */
export function isBlobUrl(u) {
  try {
    const x = new URL(u);
    if (process.env.ALLOW_LOCAL_BLOB === '1' && x.hostname === 'localhost') return true;
    return x.protocol === 'https:' && x.hostname.endsWith('blob.vercel-storage.com');
  } catch (e) {
    return false;
  }
}
