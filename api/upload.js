import { put } from '@vercel/blob';
import { configured, isAdmin, readBody } from './_lib.js';

const MAX_PART = 4 * 1024 * 1024 + 200 * 1024;

/* Nhận một phần nhỏ của file (tối đa khoảng 4 MB) và lưu vào Blob */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method' });
    }
    if (!configured()) return res.status(503).json({ error: 'not_configured' });
    if (!isAdmin(req)) return res.status(401).json({ error: 'auth' });

    const body = await readBody(req);
    if (!body.length) return res.status(400).json({ error: 'empty' });
    if (body.length > MAX_PART) return res.status(413).json({ error: 'too_big' });

    const id = String((req.query && req.query.id) || 'x').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60) || 'x';
    const n = parseInt((req.query && req.query.n) || '0', 10) || 0;

    const blob = await put('files/' + id + '/' + n + '.bin', body, {
      access: 'public',
      contentType: 'application/octet-stream',
      addRandomSuffix: true,
    });
    return res.status(200).json({ url: blob.url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server', detail: String((e && e.message) || e).slice(0, 300) });
  }
}
