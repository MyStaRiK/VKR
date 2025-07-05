// server/signatureService.js
const crypto = require('crypto');
const { createKeyPair } = require('./enhancedSignatureService');
const enhancedSigSvc = require('./enhancedSignatureService');


function sha256(txt) {
  return crypto.createHash('sha256')
               .update(txt)
               .digest('hex')
               .match(/.{1,2}/g)
               .join(' ');
}

async function listUserSigs (db, id_user) {
  return db.all(
    `SELECT id_sign, name, fingerprint, created_at
       FROM simple_signatures
      WHERE id_user = ?
      ORDER BY created_at DESC`, [id_user]);
}

async function createSimpleSig (db, id_user, name=null) {
  const fp   = sha256(`${id_user}-${Date.now()}`);
  const res  = await db.run(
    `INSERT INTO simple_signatures (id_user,name,fingerprint)
          VALUES (?,?,?)`, [id_user, name, fp]);
  return db.get(
    `SELECT id_sign, name, fingerprint, created_at
       FROM simple_signatures
      WHERE id_sign = ?`, res.lastID);
}

async function deleteSig (db, id_user, id_sign) {
  /* удаляем только свою подпись */
  return db.run(
    `DELETE FROM simple_signatures
      WHERE id_sign = ? AND id_user = ?`, [id_sign, id_user]);
}

async function listUserKeys(db, id_user) {
    return db.all(
        `SELECT id_key, name, fingerprint, created_at
           FROM user_keys
          WHERE id_user = ?
          ORDER BY created_at DESC`,
        [id_user]
    );
}

/** удалить RSA-ключ пользователя */
async function deleteKey(db, id_user, id_key) {
    /* удаляем только «свои» ключи  */
    return db.run(
      `DELETE FROM user_keys
        WHERE id_key = ? AND id_user = ?`,
      [id_key, id_user]
    );
  }

  module.exports = {
    listUserKeys,
    listUserSigs,
    createSimpleSig,
    deleteSig,
    deleteKey,
    createKeyPair,
    signRequest: enhancedSigSvc.signRequest,
    signRequestByUser: enhancedSigSvc.signRequestByUser
  };
