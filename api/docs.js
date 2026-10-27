import { put, del, list } from '@vercel/blob';
import { configured, isAdmin, isBlobUrl } from './_lib.js';

const PATH = 'docs.json';
const LOAI = ['Hướng dẫn', 'Biểu mẫu', 'Quy trình', 'Tài liệu', 'Khác'];

function str(v, n) {
  return String(v == null ? '' : v).slice(0, n);
}

/* Làm sạch một tài liệu trước khi lưu */
function clean(d) {
  const id = String(d.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
  const ten = str(d.ten, 200).trim();
  if (!id || !ten) return null;
  const o = {
    id,
    ten,
    loai: LOAI.includes(d.loai) ? d.loai : 'Khác',
    link: str(d.link, 1000),
    nhan: str(d.nhan, 300),
    ghichu: str(d.ghichu, 2000),
    ngay: str(d.ngay, 10),
  };
  const parts = Array.isArray(d.parts) ? d.parts.filter(isBlobUrl).slice(0, 60) : [];
  if (parts.length) {
    o.parts = parts;
    o.fname = str(d.fname, 200);
    o.ftype = str(d.ftype, 100);
    o.fsize = Number(d.fsize) || 0;
  }
  return o;
}

async function readDocs() {
  const r = await list({ prefix: PATH, limit: 10 });
  const b = (r.blobs || []).find((x) => x.pathname === PATH);
  if (!b) return [];
  const resp = await fetch(b.url + '?t=' + Date.now(), { cache: 'no-store' });
  if (!resp.ok) throw new Error('read ' + resp.status);
  const j = await resp.json();
  return Array.isArray(j.docs) ? j.docs : [];
}

async function writeDocs(docs) {
  await put(PATH, JSON.stringify({ docs }), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

/* Xóa các phần file không còn được dùng */
async function dropParts(oldDoc, newDoc) {
  if (!oldDoc || !Array.isArray(oldDoc.parts)) return;
  const keep = new Set((newDoc && newDoc.parts) || []);
  const gone = oldDoc.parts.filter((u) => !keep.has(u));
  if (!gone.length) return;
  try {
    await del(gone);
  } catch (e) {
    console.error('del parts', e);
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!configured()) return res.status(503).json({ error: 'not_configured' });

    if (req.method === 'GET') {
      const docs = await readDocs();
      return res.status(200).json({ ok: true, docs });
    }

    if (req.method === 'POST') {
      if (!isAdmin(req)) return res.status(401).json({ error: 'auth' });
      const b = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : {};

      if (b.op === 'login') return res.status(200).json({ ok: true });

      if (b.op === 'put') {
        const d = clean(b.doc || {});
        if (!d) return res.status(400).json({ error: 'bad_doc' });
        const docs = await readDocs();
        const i = docs.findIndex((x) => x.id === d.id);
        const old = i >= 0 ? docs[i] : null;
        if (i >= 0) docs[i] = d;
        else docs.push(d);
        await writeDocs(docs);
        await dropParts(old, d);
        return res.status(200).json({ ok: true });
      }

      if (b.op === 'del') {
        const id = String(b.id || '');
        const docs = await readDocs();
        const old = docs.find((x) => x.id === id);
        if (!old) return res.status(200).json({ ok: true });
        await writeDocs(docs.filter((x) => x.id !== id));
        await dropParts(old, null);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'bad_op' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server', detail: String((e && e.message) || e).slice(0, 300) });
  }
}
