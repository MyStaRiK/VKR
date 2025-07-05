async function addAudit(db, { id_user, ip, action, meta = {} }) {
    await db.run(
      `INSERT INTO audit_log (id_user, ip_addr, action, meta)
            VALUES (?,?,?,?)`,
      [id_user, ip, action, JSON.stringify(meta)]
    );
  }
  module.exports = { addAudit };
  