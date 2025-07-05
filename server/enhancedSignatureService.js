const { aesEncrypt, aesDecrypt, generateRSA, signBlob } = require('./cryptoUtil');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

async function createKeyPair(db, id_user, password, name = null) {
  const { privDer, pubDer } = generateRSA(); // RSA-2048

  // AES-GCM оболочка закрытого ключа
  const { iv, tag, enc, salt } = aesEncrypt(privDer, password);
  const encPriv = Buffer.concat([iv, tag, enc]); // iv|tag|ciphertext

  // fingerprint по открытому ключу
  const fp = crypto
    .createHash('sha256')
    .update(pubDer)
    .digest('hex')
    .match(/.{1,2}/g)
    .join(' ');

  const { lastID } = await db.run(
    `INSERT INTO user_keys
       (id_user, enc_priv, pub_key, salt, name, fingerprint)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id_user, encPriv, pubDer, salt, name, fp]
  );

  return db.get(
    `SELECT id_key, name, fingerprint, created_at
       FROM user_keys
      WHERE id_key = ?`,
    lastID
  );
}

async function deleteKey(db, id_user, id_key) {
  return db.run(
    `DELETE FROM user_keys WHERE id_key = ? AND id_user = ?`,
    [id_key, id_user]
  );
}

// enhancedSignatureService.js
async function signRequest(
  db,
  id_request,
  id_user,
  password,
  id_key          // ← новый аргумент
) {
  /* 1. достаём нужную заявку + именно тот ключ, который выбрал получатель */
  const req = await db.get(
    `SELECT r.id_request, r.id_document,
            uk.id_key, uk.enc_priv, uk.pub_key, uk.salt
       FROM signature_requests r
       JOIN user_keys uk
         ON uk.id_user = ?           -- получатель
        AND uk.id_key  = ?           -- выбранный ключ
      WHERE r.id_request       = ?
        AND r.id_recipient_user = ?`,
    [id_user, id_key, id_request, id_user]
  );
  if (!req) throw new Error("Ключ не найден");

  /* 2. читаем документ */
  const doc = await db.get(
    `SELECT stored_path FROM documents WHERE id_document = ?`,
    req.id_document
  );
  const fileBuf = fs.readFileSync(path.join("uploads", doc.stored_path));

  /* 3. дешифруем ключ */
  const packed = {
    iv:   req.enc_priv.subarray(0, 12),
    tag:  req.enc_priv.subarray(12, 28),
    enc:  req.enc_priv.subarray(28),
    salt: req.salt
  };
  const privDer = aesDecrypt(packed, password); // бросит, если пароль неверный

  /* 4. подписываем */
  const digest    = crypto.createHash("sha256").update(fileBuf).digest();
  const signature = signBlob(privDer, digest);

  await db.run(
    `INSERT INTO request_signatures
       (id_request, id_key, hash_alg, digest, signature)
     VALUES (?,?,?,?,?)`,
    [id_request, req.id_key, "sha256", digest, signature]
  );

  /* 5. обновляем статус = 2 «подписано» */
  await db.run(
    `UPDATE signature_requests
        SET id_status   = 2,
            updated_at = CURRENT_TIMESTAMP
      WHERE id_request = ?`,
    [id_request]
  );

  return { ok: true };
}


async function signRequestByUser(db, id_request, id_user, password, id_key) {
  // подпись отправителя сразу при создании заявки
  const req = await db.get(
    `SELECT r.id_request, r.id_document, uk.id_key, uk.enc_priv, uk.pub_key, uk.salt
       FROM signature_requests r
       JOIN user_keys uk
         ON uk.id_user = ? AND uk.id_key = ?
      WHERE r.id_request = ? AND r.id_sender = ?`,
    [id_user, id_key, id_request, id_user]
  );
  if (!req) throw new Error('Request or key not found');

  const doc = await db.get(
    `SELECT stored_path FROM documents WHERE id_document = ?`,
    req.id_document
  );
  const fileBuf = fs.readFileSync(`./uploads/${doc.stored_path}`);

  const packed = {
    iv: req.enc_priv.subarray(0, 12),
    tag: req.enc_priv.subarray(12, 28),
    enc: req.enc_priv.subarray(28),
    salt: req.salt
  };
  const privDer = aesDecrypt(packed, password);

  const digest = crypto.createHash('sha256').update(fileBuf).digest();
  const signature = signBlob(privDer, digest);

  await db.run(
    `INSERT INTO request_signatures
       (id_request, id_key, hash_alg, digest, signature)
     VALUES (?, ?, ?, ?, ?)`,
    [id_request, req.id_key, 'sha256', digest, signature]
  );
  return { ok: true };
}

module.exports = {
  createKeyPair,
  deleteKey,
  signRequest,
  signRequestByUser
};
