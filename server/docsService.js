/* docsService.js — утилиты для работы с документами пользователя */

async function listUserDocs(db, userId, limit = 10) {
  // Только если пользователь — отправитель (id_sender)
  return db.all(
    `SELECT r.id_request,
            d.id_document,
            d.original_name,
            d.mime_type,
            d.size,
            r.created_at                AS request_date,
            s.name                      AS status
       FROM signature_requests r
       JOIN documents d ON d.id_document = r.id_document
       JOIN statuses  s ON s.id_status   = r.id_status
      WHERE r.id_sender = ?
      ORDER BY r.created_at DESC
      LIMIT ?`,
    [userId, limit]
  );
}

  
  async function getDocumentForUser(db, userId, docId) {
    /* проверяет, имеет ли user право скачать документ
       (он отправитель, получатель или владелец файла) */
    return db.get(
      `SELECT d.*
         FROM documents d
         LEFT JOIN signature_requests r ON r.id_document = d.id_document
        WHERE d.id_document = ?
          AND ( d.id_user          = ?
                OR r.id_sender     = ?
                OR r.id_recipient_user = ? )`,
      [docId, userId, userId, userId]
    );
  }
  
  module.exports = { listUserDocs, getDocumentForUser };
  