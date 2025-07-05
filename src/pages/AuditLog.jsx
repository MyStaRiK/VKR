import React, { useState, useEffect } from "react";
import Header from "./Header";
import { getToken } from "../services/authService";
import styles from "./AuditLog.module.css";
import { ArrowLeft, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

function fmt(json) {
  try { return JSON.stringify(JSON.parse(json), null, 2); }
  catch { return json; }
}

function StatusBadge({ ok }) {
  if (ok === undefined) return null;
  return ok
    ? <span className={styles.okBadge}><Check size={16} /> OK</span>
    : <span className={styles.errBadge}><X size={16} /> Error</span>;
}

export default function AuditLog() {
  const token = getToken();
  const nav   = useNavigate();

  const [rows, setRows] = useState([]);
  const [page, setPg]   = useState(0);
  const [err,  setErr]  = useState("");

  const load = p => {
    fetch(`http://localhost:4000/api/audit?page=${p}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { setRows(d.logs || []); setPg(p); })
      .catch(() => setErr("API error"));
  };
  useEffect(() => load(0), [token]);

  return (
    <>
      <Header />
      <main className={styles.main}>
        <section className={styles.card}>
          <h2 className={styles.h2}>Журнал событий</h2>
          {err && <div className={styles.error}>{err}</div>}

          <div className={styles.tableWrapper}>
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th style={{ width: "22%" }}>Дата</th>
                  <th style={{ width: "18%" }}>Пользователь</th>
                  <th style={{ width: "22%" }}>Действие</th>
                  <th style={{ width: "10%" }}>Результат</th>
                  <th>Детали</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td>{r.ts}</td>
                    <td>{r.who || "—"}</td>
                    <td>{r.action}</td>
                    <td>
                      {r.action === "SIGN_DOCUMENT"
                        ? <StatusBadge ok={r.intact === 1} />
                        : ""}
                    </td>
                    <td>
                      <pre className={styles.meta}>{fmt(r.details)}</pre>
                    </td>
                  </tr>
                ))}
                {!rows.length &&
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center" }}>Пусто</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div className={styles.pager}>
            <button onClick={() => load(Math.max(page - 1, 0))} disabled={!page}>◀</button>
            <span>Стр. {page + 1}</span>
            <button onClick={() => load(page + 1)} disabled={rows.length < 50}>▶</button>
          </div>
        </section>

        <button className={styles.backFab} onClick={() => nav('/dashboard')}>
          <ArrowLeft size={18} /> Назад
        </button>
      </main>
    </>
  );
}
