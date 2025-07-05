const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authenticator } = require('otplib');
const { PDFDocument, StandardFonts } = require('pdf-lib');

const { addAudit }   = require('./logUtil');         
const reqSvc  = require('./requestService');
const docsSvc = require('./docsService');
const sigSvc  = require("./signatureService");

const tsaDir = path.resolve(__dirname, 'tsa');        
if (!fs.existsSync(tsaDir)) fs.mkdirSync(tsaDir);

async function makeReceipt({ user, reqId, fingerprint }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const draw = (y, txt, s = 12) =>
    page.drawText(txt, { x: 50, y, size: s, font });
  draw(780, 'Квитанция подписи', 18);
  draw(740, `Кто: ${user.full_name} <${user.email}>`, 14);
  draw(720, `Заявка ID: ${reqId}`, 14);
  draw(700, `fingerprint: ${fingerprint}`);
  draw(680, `UTC: ${new Date().toISOString()}`);
  const bytes = await pdf.save();
  const file = path.join(tsaDir, `receipt-${reqId}.pdf`);
  fs.writeFileSync(file, bytes);
  return `/tsa/receipt-${reqId}.pdf`;
}

async function mkTsaToken(db, digest) {
  const { lastID } = await db.run(
    `INSERT INTO tsa_tokens(digest) VALUES(?)`,
    [digest]
  );
  return db.get(`SELECT * FROM tsa_tokens WHERE id_token = ?`, lastID);
}
/* ───────── Константы ───────── */
const PORT = 4000;
const JWT_SECRET = 'replace_with_a_strong_secret';
const DB_FILE = path.resolve(__dirname, 'danabase.db');
const UPLOAD_DIR = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ───────── Утилиты для имён файлов ───────── */

/* 1. Если имя выглядит как ‘ÃÂ¾Ãâ¦’ — декодируем его из latin1 → utf8 */
function fixFilename(name) {
  const looksBroken =
    !/[А-Яа-яЁё]/.test(name) &&          // кириллицы нет
    /[ÃÐÑ]/.test(name);                 // но есть типичные «кракозябры»
  return looksBroken ? Buffer.from(name, 'latin1').toString('utf8') : name;
}

/* 2. Чистим недопустимые символы для файловой системы */
function sanitizeForFS(name) {
  const decoded = fixFilename(name);
  const base    = path.basename(decoded);
  return base.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

/* ───────── Multer ───────── */
const storage = multer.diskStorage({
  destination: (_req, _f, cb)=>cb(null, UPLOAD_DIR),
  filename: (_req, file, cb)=>cb(null, `${Date.now()}-${sanitizeForFS(file.originalname)}`)
});
const upload = multer({ storage });

/* ───────── База данных / JWT ───────── */
async function initDb() {
  const db = await open({ filename: DB_FILE, driver: sqlite3.Database });
  await db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'Unauthorized: No token' });
  try {
    const token = h.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized: Bad token' });
  }
}

// ───────── Приложение ─────────
async function main() {
  const db  = await initDb();
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // ---------- Регистрация / Логин ----------
  app.post('/register', async (req, res) => {
    const { full_name, email, password, id_group, telephone, id_role, id_signature } = req.body;
    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'full_name, email и password обязательны' });
    }
    try {
      const hash = await bcrypt.hash(password, 10);
      const result = await db.run(
        `INSERT INTO users (full_name, email, password, id_group, telephone, id_role, id_signature)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [full_name, email, hash, id_group, telephone, id_role, id_signature]
      );
      const user = await db.get(
        `SELECT id_user, full_name, email, id_group, telephone, id_role, id_signature
           FROM users WHERE id_user = ?`,
        result.lastID
      );
      res.status(201).json({ user });
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
      }
      console.error(err);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  });

app.post('/login', async (req,res)=>{
  const { email,password } = req.body;
  const user = await db.get('SELECT * FROM users WHERE email=?', email);
  if(!user||!(await bcrypt.compare(password,user.password)))
      return res.status(401).json({error:'Неверные данные.'});
  if(user.otp_enabled){
      const tmp = jwt.sign({id_user:user.id_user,stage:'otp'},JWT_SECRET,{expiresIn:'5m'});
      return res.json({ need_otp:true, tmp_token: tmp });
  }
  const token = jwt.sign({id_user:user.id_user},JWT_SECRET,{expiresIn:'8h'});
  res.json({ token, user:{id_user:user.id_user,email:user.email} });
});

app.post('/login/otp', authMiddleware, async (req,res)=>{
  if(req.user.stage!=='otp') return res.status(400).json({error:'BAD_STAGE'});
  const user = await db.get('SELECT * FROM users WHERE id_user=?', req.user.id_user);
  const ok = authenticator.check(req.body.code, user.otp_secret);
  if(!ok) return res.status(401).json({error:'Код неверный.'});
  const token = jwt.sign({id_user:user.id_user},JWT_SECRET,{expiresIn:'8h'});
  res.json({ token, user:{id_user:user.id_user,email:user.email} });
});

  // ---------- Справочники ----------
  app.get('/api/groups', authMiddleware, async (_req, res) => {
    try { res.json({ groups: await db.all('SELECT id_group, name FROM groups ORDER BY name') }); }
    catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
  });

  app.get('/api/roles', authMiddleware, async (_req, res) => {
    try { res.json({ roles: await db.all('SELECT id_role, name FROM roles ORDER BY name') }); }
    catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
  });

  app.get('/api/departments', authMiddleware, async (_req, res) => {
    try { res.json({ departments: await reqSvc.listDepartments(db) }); }
    catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
  });

app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const users = await reqSvc.listUsers(db, req.user.id_user);
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


  // ---------- Профиль ----------
  app.get('/api/profile', authMiddleware, async (req, res) => {
    try {
       const user = await db.get(
   `SELECT id_user, full_name, email, id_group, telephone, id_role,
           otp_enabled               -- ← добавили!
      FROM users
     WHERE id_user = ?`,
   req.user.id_user);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ user });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
  });

  app.put('/api/profile', authMiddleware, async (req, res) => {
    const { full_name, id_group, telephone, id_role } = req.body;
    try {
      await db.run(`UPDATE users SET full_name = ?, id_group = ?, telephone = ?, id_role = ? WHERE id_user = ?`, [full_name, id_group, telephone, id_role, req.user.id_user]);
      const updated = await db.get(`SELECT id_user, full_name, email, id_group, telephone, id_role FROM users WHERE id_user = ?`, req.user.id_user);
      res.json({ user: updated });
    } catch (err) {
      console.error(err);
      if (err.code === 'SQLITE_CONSTRAINT' && /FOREIGN KEY/.test(err.message)) return res.status(400).json({ error: 'Неверная группа или роль' });
      res.status(500).json({ error: 'Server error' });
    }
  });

  // ---------- Документы ----------
  app.post(
    '/api/documents',
    authMiddleware,
    upload.single('document'),
    async (req, res) => {
      try {
        /* исправляем оригинальное имя для записи в БД */
        const original = fixFilename(req.file.originalname);

        /* вставляем */
        const result = await db.run(
          `INSERT INTO documents
             (id_user, original_name, stored_path, mime_type, size)
           VALUES (?, ?, ?, ?, ?)`,
          [
            req.user.id_user,
            original,
            req.file.filename,      // уже безопасное имя
            req.file.mimetype,
            req.file.size
          ]
        );
        const document = await db.get(
          'SELECT * FROM documents WHERE id_document = ?',
          result.lastID
        );
        res.status(201).json({ document });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Не удалось сохранить документ' });
      }
    }
  );

  app.get('/api/my-requests', authMiddleware, async (req, res) => {
    try {
      const requests = await reqSvc.listUserRequests(db, req.user.id_user);
      res.json({ requests });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.get('/api/documents', authMiddleware, async (req, res) => {
    try {
      const docs = await db.all(`SELECT id_document, original_name, mime_type, size, uploaded_at FROM documents WHERE id_user = ? ORDER BY uploaded_at DESC`, req.user.id_user);
      res.json({ documents: docs });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
  });

  app.get(
    '/api/documents/:id/download',
    authMiddleware,
    async (req, res) => {
      try {
        const doc = await docsSvc.getDocumentForUser(
          db,
          req.user.id_user,
          req.params.id
        );
        if (!doc) return res.status(404).json({ error: 'Документ недоступен' });

        res.download(
          path.join(UPLOAD_DIR, doc.stored_path),
          doc.original_name      // русское имя вернётся корректно
        );
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    }
  );

  app.patch('/api/documents/:id', authMiddleware, upload.single('file'), async (q,r)=>{
    try{
      /* проверяем, связан ли документ с уже подписанной заявкой */
      const signed = await db.get(
        `SELECT 1
           FROM request_signatures rs
           JOIN signature_requests s ON s.id_request = rs.id_request
          WHERE s.id_document = ?`,
        q.params.id
      );
      if (signed) return r.status(409).json({ error:'DOC_ALREADY_SIGNED' });
  
      /* обновляем */
      await db.run(
        `UPDATE documents
            SET stored_path = ?,
                original_name = ?,
                mime_type = ?,
                size = ?
          WHERE id_document = ?`,
        [ q.file.filename, q.file.originalname, q.file.mimetype, q.file.size,
          q.params.id ]
      );
      res.json({ ok:true });
    }catch(e){
      console.error(e);
      res.status(500).json({ error:'DOC_UPDATE_FAIL' });
    }
  });

  // ---------- Заявки ----------
  app.post('/api/requests', authMiddleware, async (req, res) => {
    try {
      // проверяем, что есть ключи
      const userKeys = await sigSvc.listUserKeys(db, req.user.id_user);
      if (!userKeys.length) {
        return res
          .status(400)
          .json({ error: 'У вас нет ни одного ключа для подписи' });
      }

      const {
        id_document,
        id_recipient_user,
        id_recipient_dept,
        comment_sender,
        id_key,
        password
      } = req.body;

      // валидация ключа и пароля
      if (!id_key || !password) {
        return res
          .status(400)
          .json({ error: 'Требуется ключ и пароль для подписи' });
      }
      if (!userKeys.find(k => k.id_key === id_key)) {
        return res
          .status(400)
          .json({ error: 'Ключ не найден или не принадлежит вам' });
      }

      // создаём заявку
      const request = await reqSvc.createSignatureRequest(db, {
        id_document,
        id_sender: req.user.id_user,
        id_recipient_user: id_recipient_user || null,
        id_recipient_dept: id_recipient_dept || null,
        comment_sender: comment_sender || null
      });

      // подписываем от имени отправителя
      try {
        await sigSvc.signRequestByUser(
          db,
          request.id_request,
          req.user.id_user,
          password,
          id_key
        );
      } catch (err) {
        // если не удалось подписать — откатываем
        await reqSvc.deleteSignatureRequest(
          db,
          request.id_request,
          req.user.id_user
        );
        return res
          .status(400)
          .json({ error: 'Не удалось подписать — неверный пароль или ключ' });
      }

      res.status(201).json({ request });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Не удалось создать заявку' });
    }
  });

  app.get('/api/requests', authMiddleware, async (req, res) => {
    try {
      const sent = await db.all(`SELECT r.*, s.name as status_name FROM signature_requests r JOIN statuses s ON r.id_status = s.id_status WHERE r.id_sender = ? ORDER BY r.created_at DESC`, req.user.id_user);
      const received = await db.all(`SELECT r.*, s.name as status_name FROM signature_requests r JOIN statuses s ON r.id_status = s.id_status WHERE r.id_recipient_user = ? OR r.id_recipient_dept IS NOT NULL ORDER BY r.created_at DESC`, req.user.id_user);
      res.json({ sent, received });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
  });

  app.post('/api/requests/:id/comments', authMiddleware, async (req, res) => {
    const { comment } = req.body;
    try {
      const result = await db.run(`INSERT INTO request_comments (id_request, id_user, comment) VALUES (?, ?, ?)`, [req.params.id, req.user.id_user, comment]);
      const com = await db.get(`SELECT * FROM request_comments WHERE id_comment = ?`, result.lastID);
      res.status(201).json({ comment: com });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Не удалось добавить комментарий' }); }
  });

  app.get('/api/incoming-requests', authMiddleware, async (req, res) => {
    try {
      const tasks = await reqSvc.listIncomingRequests(db, req.user.id_user);
      res.json({ tasks });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Server error' });
    }
  });

/* ---------- Подписать заявку ---------- */
/* ─── Подписать заявку (получатель) ─── */
app.post('/api/requests/:id/sign', authMiddleware, async (req, res) => {
  try {
    const { id_key, password } = req.body;

    /* базовая проверка входных данных */
    if (!id_key || !password) {
      return res
        .status(400)
        .json({ error: 'KEY_AND_PASSWORD_REQUIRED' });
    }

    /* вызываем сервис подписи: он
       ① проверит, что ключ принадлежит получателю,
       ② вставит запись в request_signatures,
       ③ поменяет id_status на 2 («подписано») */
    await sigSvc.signRequest(
      db,
      Number(req.params.id),          // id_request
      req.user.id_user,               // id_recipient_user
      password,                       // пароль
      Number(id_key)                  // выбранный ключ
    );

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message || 'SIGN_FAIL' });
  }
});


  
  app.post('/api/requests/:id/reject', authMiddleware, async (req, res) => {
    const comment = req.body?.comment || null;
    try {
      // id_status = 3 → «rejected»
      const ok = await db.run(
        `UPDATE signature_requests
            SET id_status = 3,
                comment_sender = ?,
                updated_at = CURRENT_TIMESTAMP
          WHERE id_request = ?
            AND id_recipient_user = ?`,
        [comment, req.params.id, req.user.id_user]
      );
      if (!ok.changes) return res.status(403).json({ error: 'Нет прав' });
  
      const rq = await db.get(
        'SELECT * FROM signature_requests WHERE id_request = ?',
        req.params.id
      );
      res.json({ request: rq });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Не удалось отклонить' });
    }
  });

  app.get('/api/my-documents', authMiddleware, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    try {
      const documents = await docsSvc.listUserDocs(db, req.user.id_user, limit);
      res.json({ documents });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.get('/api/requests/:id', authMiddleware, async (req, res) => {
    try {
      const r = await reqSvc.getRequest(db, req.params.id, req.user.id_user);
      if (!r) return res.status(404).json({ error: 'Заявка не найдена' });
      res.json({ request: r });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
  });

  /* === NEW: обновить заявку === */
  app.put('/api/requests/:id', authMiddleware, async (req, res) => {
    try {
      const r = await reqSvc.updateSignatureRequest(
        db,
        req.params.id,
        req.user.id_user,
        {
          id_document:       req.body.id_document,
          id_recipient_user: req.body.id_recipient_user,
          id_recipient_dept: req.body.id_recipient_dept,
          comment_sender:    req.body.comment_sender
        }
      );
      res.json({ request: r });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Не удалось изменить заявку' });
    }
  });

  /* === NEW: удалить заявку === */
  app.delete('/api/requests/:id', authMiddleware, async (req, res) => {
    try {
      await reqSvc.deleteSignatureRequest(db, req.params.id, req.user.id_user);
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Не удалось удалить' });
    }
  });

  app.get('/api/signatures', authMiddleware, async (req, res) => {
    try {
      const list = await sigSvc.listUserSigs(db, req.user.id_user);
      res.json({ signatures: list });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  /* «простая» подпись */
  app.post('/api/signatures/simple', authMiddleware, async (req, res) => {
    try {
      const sig = await sigSvc.createSimpleSig(
        db,
        req.user.id_user,
        req.body?.name || null           // «человеческое» имя подписи (опц.)
      );
      res.status(201).json({ signature: sig });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Не удалось создать подпись' });
    }
  });

  app.post('/api/signatures/enhanced', (_req, res) =>
    res.status(501).json({ error: 'Усиленная подпись пока не реализована' })
  );
  
  /** Удалить свою подпись (физически ключи не восстанавливаются) */
  app.delete('/api/signatures/:id', authMiddleware, async (req, res) => {
    try {
      const r = await sigSvc.deleteSig(db, req.user.id_user, req.params.id);
      if (!r.changes) return res.status(404).json({ error: 'Не найдено' });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Не удалось удалить подпись' });
    }
  });
  
app.use('/tsa', express.static(tsaDir));

app.post('/api/keys', authMiddleware, async (req,res)=>{
  const { password, name } = req.body;
  if(!password || password.length<8)
        return res.status(400).json({error:'weak password'});
  const k = await sigSvc.createKeyPair(db, req.user.id_user, password, name);
  res.status(201).json({ key: k });
});
// === список моих ключей =============================================
app.get('/api/keys', authMiddleware, async (req, res) => {
    try {
      const keys = await sigSvc.listUserKeys(db, req.user.id_user);
      res.json({ keys });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Server error' });
    }
  });


  app.delete('/api/keys/:id', authMiddleware, async (req, res) => {
    await sigSvc.deleteKey(db, req.user.id_user, req.params.id);
    await addAudit(db, { id_user: req.user.id_user, ip: req.ip,
                         action: 'DELETE_KEY', meta: { id_key: req.params.id } });
    res.json({ ok: true });
  });
  
  app.post('/api/requests/:id/reject', authMiddleware, async (req, res) => {
    try {
      await db.run(
        `UPDATE signature_requests
           SET id_status = 3, updated_at = CURRENT_TIMESTAMP
         WHERE id_request = ? AND id_recipient_user = ?`,
        [Number(req.params.id), req.user.id_user]
      );
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Не удалось отклонить заявку' });
    }
  });

/* ─── Журнал событий + подробные подписи ─── */
app.get('/api/audit', authMiddleware, async (req, res) => {
  try {
    const page   = Math.max(Number(req.query.page) || 0, 0);
    const limit  = 50;
    const offset = page * limit;

    /* ① системные записи из audit_log */
    const sys = await db.all(
      `SELECT al.id_audit                AS id,
              u.full_name               AS who,
              al.action                 AS action,
              al.meta                   AS details,
              al.ip_addr                AS ip,
              strftime('%Y-%m-%d %H:%M:%S', al.created_at) AS ts,
              1                         AS intact          -- всегда true
         FROM audit_log al
         LEFT JOIN users u ON u.id_user = al.id_user
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    /* ② подписи документов: берём digest + текущий digest для проверки */
    const signRows = await db.all(
      `SELECT rs.rowid + 1000000         AS id,
              us.full_name              AS who,
              'SIGN_DOCUMENT'           AS action,
              rs.digest                 AS orig_digest,
              uk.fingerprint            AS fingerprint,
              r.id_request              AS request_id,
              d.original_name           AS doc_name,
              d.stored_path             AS stored_path,
              ''                        AS ip,
              strftime('%Y-%m-%d %H:%M:%S', r.updated_at) AS ts
         FROM request_signatures rs
         JOIN user_keys          uk ON uk.id_key   = rs.id_key
         JOIN users              us ON us.id_user  = uk.id_user
         JOIN signature_requests  r ON r.id_request = rs.id_request
         JOIN documents          d  ON d.id_document = r.id_document
        ORDER BY r.updated_at DESC
        LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    /* вычисляем текущий digest и формируем JSON-details + флаг intact */
    const crypto = require('crypto');
    const fs     = require('fs');
    const path   = require('path');

    const sign = signRows.map(row => {
      let currentDigest = null;
      let ok            = false;

      try {
        const buf = fs.readFileSync(path.join('uploads', row.stored_path));
        currentDigest = crypto.createHash('sha256').update(buf).digest('hex');
        ok = currentDigest === Buffer.from(row.orig_digest).toString('hex');
      } catch (_) { /* файл не найден */ }

      return {
        id   : row.id,
        who  : row.who,
        action: row.action,
        ip   : row.ip,
        ts   : row.ts,
        intact: ok ? 1 : 0,
        details: JSON.stringify({
          document   : row.doc_name,
          requestId  : row.request_id,
          fingerprint: row.fingerprint,
          digest_ok  : ok
        })
      };
    });

    /* объединяем, сортируем */
    const merged = [...sys, ...sign]
      .sort((a, b) => (a.ts > b.ts ? -1 : 1))
      .slice(0, limit);

    res.json({ logs: merged });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'LOG_FETCH_ERROR' });
  }
});

app.post('/api/2fa/enable', authMiddleware, async (req,res)=>{
  const u = await db.get(
        'SELECT otp_enabled FROM users WHERE id_user=?', req.user.id_user);
  if (Number(u.otp_enabled) === 1)
      return res.status(409).json({ error:'ALREADY_ENABLED' });

  const secret = authenticator.generateSecret();
  await db.run(
     `UPDATE users SET otp_secret=?, otp_enabled=0 WHERE id_user=?`,
     [secret, req.user.id_user]);
  const uri = authenticator.keyuri(req.user.email,'My-DMS',secret);
  res.json({ otpauth: uri });
});

app.post('/api/2fa/verify', authMiddleware, async (req,res)=>{
  const { code } = req.body;
  const u = await db.get(`SELECT otp_secret FROM users WHERE id_user=?`,
                         req.user.id_user);
  if(!u?.otp_secret) return res.status(400).json({error:'2FA not initiated'});
  const ok = authenticator.check(code, u.otp_secret);
  if(!ok) return res.status(401).json({error:'Код неверный'});
  await db.run(`UPDATE users SET otp_enabled=1 WHERE id_user=?`,req.user.id_user);
  res.json({ ok:true });
});

  // ---------- Запуск ----------
  app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
}
main().catch(err => console.error('Failed to start server:', err));
