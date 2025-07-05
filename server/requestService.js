/* requestService.js — бизнес‑логика “заявок” */
async function listDepartments(db) {
  return db.all(`SELECT id_dept, name FROM departments ORDER BY name`);
}

async function listUsers(db, excludeUserId = null) {
  if (excludeUserId) {
    return db.all(
      `SELECT id_user, full_name, email
         FROM users
        WHERE id_user != ?
        ORDER BY full_name`,
      [excludeUserId]
    );
  } else {
    return db.all(
      `SELECT id_user, full_name, email
         FROM users
        ORDER BY full_name`
    );
  }
}


async function insertDocument(db, { id_user, file }) {
  const res = await db.run(
    `INSERT INTO documents
       (id_user, original_name, stored_path, mime_type, size)
     VALUES (?, ?, ?, ?, ?)`,
    [id_user, file.originalname, file.filename, file.mimetype, file.size]
  );
  return db.get(`SELECT * FROM documents WHERE id_document = ?`, res.lastID);
}

async function createSignatureRequest(db, data) {
  const res = await db.run(
    `INSERT INTO signature_requests
       (id_document, id_sender,
        id_recipient_user, id_recipient_dept,
        id_status, comment_sender)
     VALUES (?, ?, ?, ?, 1, ?)`,
    [
      data.id_document,
      data.id_sender,
      data.id_recipient_user || null,
      data.id_recipient_dept || null,
      data.comment_sender || null
    ]
  );
  return db.get(
    `SELECT * FROM signature_requests WHERE id_request = ?`,
    res.lastID
  );
}

async function listUserRequests(db, userId) {
  return db.all(
    `SELECT r.id_request,
            d.id_document,
            d.original_name,
            r.created_at,
            s.name             AS status,
            COALESCE(rc.cnt,0) AS comment_count,
            CASE
              WHEN r.id_recipient_user  IS NOT NULL
                   THEN (SELECT full_name FROM users WHERE id_user  = r.id_recipient_user)
              WHEN r.id_recipient_dept  IS NOT NULL
                   THEN (SELECT name      FROM departments WHERE id_dept = r.id_recipient_dept)
              ELSE '—'
            END                AS recipient_name
       FROM signature_requests r
       JOIN documents d ON d.id_document = r.id_document
       JOIN statuses  s ON s.id_status   = r.id_status
       LEFT JOIN (
         SELECT id_request, COUNT(*) AS cnt
           FROM request_comments
          GROUP BY id_request
       ) rc ON rc.id_request = r.id_request
      WHERE r.id_sender = ?
      ORDER BY r.created_at DESC`,
    [userId]
  );
}

async function getRequest(db, id, userId) {
  return db.get(
    `SELECT * FROM signature_requests
      WHERE id_request = ? AND id_sender = ?`,
    [id, userId]
  );
}

async function updateSignatureRequest(db, id, userId, data) {
  // Получаем текущий статус заявки
  const req = await db.get(
    `SELECT id_status FROM signature_requests WHERE id_request = ? AND id_sender = ?`,
    id, userId
  );
  if (!req) return null;

  // Если заявка была отклонена — сбрасываем статус на "ожидает"
  const newStatus = req.id_status === 3 ? 1 : req.id_status;

  await db.run(
    `UPDATE signature_requests
        SET id_document       = COALESCE(?, id_document),
            id_recipient_user = ?,
            id_recipient_dept = ?,
            comment_sender    = ?,
            id_status        = ?,
            updated_at       = CURRENT_TIMESTAMP
      WHERE id_request = ? AND id_sender = ?`,
    [
      data.id_document || null,
      data.id_recipient_user || null,
      data.id_recipient_dept || null,
      data.comment_sender || null,
      newStatus,
      id,
      userId
    ]
  );
  return db.get(`SELECT * FROM signature_requests WHERE id_request = ?`, id);
}

async function deleteSignatureRequest(db, id, userId) {
  return db.run(
    `DELETE FROM signature_requests
      WHERE id_request = ? AND id_sender = ?`,
    [id, userId]
  );
}

async function listIncomingRequests(db, userId) {
  return db.all(
    `SELECT r.id_request,
            d.id_document,
            d.original_name,
            r.created_at,
            s.name        AS status,
            u.full_name   AS sender_name
       FROM signature_requests r
       JOIN documents d ON d.id_document = r.id_document
       JOIN statuses  s ON s.id_status   = r.id_status
       JOIN users     u ON u.id_user     = r.id_sender
      WHERE r.id_recipient_user = ?
      ORDER BY r.created_at DESC`,
    [userId]
  );
}

module.exports = {
  listDepartments,
  listUsers,
  insertDocument,
  createSignatureRequest,
  listUserRequests,
  listIncomingRequests,
  getRequest,
  updateSignatureRequest,
  deleteSignatureRequest
};
