// Файлы «Декора» (фото и видео): отчёты с объекта и доказательства действий (выдача, финальный возврат, «сдал кассиру»).
// Лежат на диске сервера, папка на каждую компанию (DECOR_UPLOADS_DIR, по умолчанию backend/uploads/decor) — нужна в бэкапе.
// В базе — описание (decor_report_files: у файла report_id или evidence_id). Отдаются только по токену той же компании.
// Лимиты размера — в настройках компании (photo_max_mb, video_max_mb, D24); здесь — общий потолок для приёма запроса.
const fs = require('fs');
const path = require('path');
const { fail } = require('./common');

const UPLOAD_DIR = path.resolve(process.env.DECOR_UPLOADS_DIR || path.join(__dirname, '..', 'uploads', 'decor'));
const HARD_MAX_MB = Number(process.env.DECOR_UPLOAD_MAX_MB) || 500;   // не меньше самого большого лимита видео в настройках
const MAX_FILES = 10;
const ALLOWED_MIME = /^(image\/(jpeg|png|webp|gif|heic|heif|avif)|video\/(mp4|quicktime|webm|3gpp|x-matroska))$/i;

let multerArray = null;
try {
  const multer = require('multer');
  multerArray = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => { const d = path.join(UPLOAD_DIR, String(req.decor.cid)); fs.mkdirSync(d, { recursive: true }); cb(null, d); },
      filename: (req, file, cb) => cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${path.extname(file.originalname || '').slice(0, 10).toLowerCase()}`),
    }),
    limits: { fileSize: HARD_MAX_MB * 1024 * 1024, files: MAX_FILES },
    // [wareapp 2026-10-26] Только растровые фото и видео. SVG — это документ со скриптами: миниатюра открывается
    // в новой вкладке через blob на нашем домене, и скрипт из «фото» прочитал бы токены входа.
    fileFilter: (req, file, cb) => (ALLOWED_MIME.test(file.mimetype) ? cb(null, true)
      : cb(Object.assign(new Error('Можно загружать только фото и видео'), { code: 'BAD_TYPE' }))),
  }).array('files', MAX_FILES);
} catch { console.error('decor: multer не установлен — загрузка фото и видео выключена'); }

// Имя файла с телефона приходит в latin1 — переводим в UTF-8 (кириллица в именах)
const fileName = f => Buffer.from(f.originalname || '', 'latin1').toString('utf8').slice(0, 255);
const mb = bytes => (bytes / 1048576).toFixed(1).replace('.', ',');
const removeFiles = files => (files || []).forEach(f => fs.unlink(f.path, () => {}));

// Приём multipart/form-data (поле files[] + поля формы). Запрос без файлов (JSON) проходит как есть.
function upload(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  if (!multerArray) return res.status(501).json({ error: 'Загрузка файлов не настроена на сервере (нет multer)' });
  multerArray(req, res, err => {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `Файл больше ${HARD_MAX_MB} МБ`, code: 'file_too_big' });
    if (err?.code === 'LIMIT_FILE_COUNT' || err?.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ error: `Не больше ${MAX_FILES} файлов за раз` });
    if (err) return res.status(400).json({ error: err.message, ...(err.code === 'BAD_TYPE' ? { code: 'bad_type' } : {}) });
    next();
  });
}

// Обработчик с файлами: при любой ошибке (и при повторе — файлы уже сохранены первым запросом) файлы этого запроса удаляются
const withFiles = fn => async (req, res, next) => {
  try { await fn(req, res, next); } catch (e) { removeFiles(req.files); throw e; }
};

// Поле формы со списком (lines) приходит строкой JSON
function jsonField(v, label) {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return fail(400, `${label}: неверный формат`); }
}

// Лимиты компании: фото до photo_max_mb, видео до video_max_mb — понятный текст и ни одного сохранённого файла
async function checkSizes(db, req) {
  const files = req.files || [];
  if (!files.length) return;
  const { rows: [s] } = await db.query('SELECT photo_max_mb, video_max_mb FROM decor_settings WHERE company_id=$1', [req.decor.cid]);
  for (const f of files) {
    const video = /^video\//.test(f.mimetype);
    const limit = video ? s.video_max_mb : s.photo_max_mb;
    if (f.size > limit * 1048576) {
      fail(413, `${video ? 'Видео' : 'Фото'} «${fileName(f)}» — ${mb(f.size)} МБ, больше лимита ${limit} МБ`,
        { code: 'file_too_big', kind: video ? 'video' : 'photo', name: fileName(f), size_mb: Number((f.size / 1048576).toFixed(1)), limit_mb: limit });
    }
  }
}

// Описание файлов в базе: owner = { report_id } или { evidence_id }
async function saveFiles(c, req, owner) {
  for (const f of req.files || []) {
    await c.query(`INSERT INTO decor_report_files (company_id, report_id, evidence_id, kind, file_name, original_name, mime, size_bytes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [req.decor.cid, owner.report_id || null, owner.evidence_id || null,
      /^image\//.test(f.mimetype) ? 'image' : 'video', path.basename(f.path), fileName(f), f.mimetype, f.size]);
  }
}

// Сколько места занимают файлы компании (Настройки)
async function usage(db, cid) {
  const { rows } = await db.query(`SELECT kind, count(*)::int AS files, COALESCE(sum(size_bytes),0)::float8 AS bytes
    FROM decor_report_files WHERE company_id=$1 GROUP BY kind`, [cid]);
  const of = k => rows.find(r => r.kind === k) || { files: 0, bytes: 0 };
  return { photos: { files: of('image').files, bytes: of('image').bytes }, videos: { files: of('video').files, bytes: of('video').bytes },
    total_bytes: of('image').bytes + of('video').bytes, files: of('image').files + of('video').files };
}

module.exports = { UPLOAD_DIR, MAX_FILES, HARD_MAX_MB, upload, withFiles, jsonField, checkSizes, saveFiles, removeFiles, usage, fileName };
