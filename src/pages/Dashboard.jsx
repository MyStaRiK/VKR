import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getToken } from "../services/authService";
import Header from "./Header";
import styles from "./Dashboard.module.css";

/* ── иконка‑файл с цветом по расширению ─────────────────────────── */
const colorByExt = {
  pdf:  "#EF4444",
  doc:  "#3B82F6", docx: "#3B82F6",
  xls:  "#22C55E", xlsx:"#22C55E",
  ppt:  "#F97316", pptx:"#F97316",
  txt:  "#6B7280"
};
const pickColor = ext => colorByExt[ext] || "#9CA3AF";          // default — серый

const FileIcon = ({ ext }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={pickColor(ext)}>
    <path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5" />
  </svg>
);

/* ── бейдж статуса ──────────────────────────────────────────────── */
const StatusTag = ({ status = "" }) => {
  const s = status.toString().toLowerCase();

  const css =
    s.includes("signed")   || s.includes("подпис") ? "signed"   :
    s.includes("reject")   || s.includes("отклон") ? "rejected" :
    /* иначе */                                           "pending";

  /* русский текст выводим как есть, если пришёл; можно и свой словарь */
  return <span className={`${styles.status} ${styles[css]}`}>{status}</span>;
};

export default function Dashboard() {
  /* переключатель темы */
  const [light, setLight] = useState(false);
  useEffect(() => { document.documentElement.classList.toggle("theme-light", light); }, [light]);

  /* документы */
  const [docs, setDocs] = useState([]);
  useEffect(() => {
    const token = getToken();
    fetch("http://localhost:4000/api/my-documents?limit=3", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setDocs(d.documents || []))
      .catch(() => setDocs([]));
  }, []);

  /* скачивание */
  const downloadFile = async (id, name) => {
    try {
      const token = getToken();
      const res = await fetch(`http://localhost:4000/api/documents/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = name; a.click();
      window.URL.revokeObjectURL(url);
    } catch { alert("Не удалось скачать файл"); }
  };

  return (
    <>
      <Header />

      <main className={styles.main}>
        <section className={`${styles.card} ${styles.docsCard}`}>
          <h2>Последние документы</h2>

          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: "46%" }}>Название</th>
                <th style={{ width: "22%" }}>Дата</th>
                <th style={{ width: "15%" }}>Статус</th>
                <th>Действие</th>
              </tr>
            </thead>

            <tbody>
              {docs.map(d => {
                const ext = (d.original_name.split(".").pop() || "").toLowerCase();
                return (
                  <tr key={d.id_request}>
                    <td>
                      <button
                        type="button"
                        className={styles.fileLink}
                        onClick={() => downloadFile(d.id_document, d.original_name)}
                        title={d.original_name}
                      >
                        <FileIcon ext={ext} />
                        <span className={styles.fileName}>{d.original_name}</span>
                      </button>
                    </td>
                    <td>{new Date(d.request_date).toLocaleString()}</td>
                    <td><StatusTag status={d.status} /></td>
                    <td>
                       <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => alert("Функция находится в разработке")}
                      >
                        Перейти
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!docs.length && (
                <tr><td colSpan={4} style={{ textAlign: "center" }}>Документов пока нет</td></tr>
              )}
            </tbody>
          </table>

          <Link to="/documents" className={styles.btnPrimary}>Перейти ко всем документам</Link>
        </section>

        {/* Новости (как было) */}
        <div className={styles.newsGrid}>
          <section className={`${styles.card} ${styles.newsCard}`}>
            <h3>Новости системы</h3>
            <ul>
              <li>💡 Добавлена массовая подпись.</li>
              <li>⚙️ Улучшена скорость PDF.</li>
              <li>🔐 Обновлены сертификаты.</li>
            </ul>
          </section>
          <section className={`${styles.card} ${styles.newsCard}`}>
            <h3>Объявления университета</h3>
            <ul>
              <li>📅 До 31 мая — стипендия.</li>
              <li>📊 16 мая — вебинар.</li>
              <li>📁 Новые шаблоны заявлений.</li>
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
