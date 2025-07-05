import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Edit, Trash2, ArrowLeft } from "lucide-react";
import { getToken } from "../services/authService";
import Header from "./Header";
import styles from "./Documents.module.css";

/* ── цветные иконки ─────────────────────────────────────────────── */
const colorByExt = {
  pdf: "#EF4444",
  doc: "#3B82F6",
  docx: "#3B82F6",
  xls: "#22C55E",
  xlsx: "#22C55E",
  ppt: "#F97316",
  pptx: "#F97316",
  txt: "#6B7280"
};
const pickColor = ext => colorByExt[ext] || "#9CA3AF";
const FileIcon = ({ ext }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={pickColor(ext)}>
    <path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1-2-2Zm7 1.5V8h4.5" />
  </svg>
);

/* ── бейдж статуса ──────────────────────────────────────────────── */
const StatusTag = ({ s }) => (
  <span className={`${styles.status} ${styles[s]}`}>
    {s === "signed" ? "Подписан" : s === "pending" ? "Ожидает" : "Отклонён"}
  </span>
);

export default function Documents() {
  const navigate = useNavigate();
  const [allDocs, setAllDocs] = useState([]);
  const [deleting, setDeleting] = useState(null);

  /* ---------- получение списка ---------- */
  const fetchList = () => {
    const token = getToken();
    fetch("http://localhost:4000/api/my-requests", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        const docs = (d.requests || []).map(r => ({
          id: r.id_request,
          idDoc: r.id_document,
          name: r.original_name,
          date: new Date(r.created_at).toLocaleString(),
          route: `Я → ${r.recipient_name}`,
          status: /подпис/i.test(r.status)
            ? "signed"
            : /отклон/i.test(r.status)
            ? "rejected"
            : "pending",
          badge: r.comment_count
        }));
        setAllDocs(docs);
      })
      .catch(() => setAllDocs([]));
  };
  useEffect(fetchList, []);

  /* ---------- фильтры ---------- */
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const docs = useMemo(
    () =>
      allDocs.filter(
        d =>
          (filter === "all" || d.status === filter) &&
          d.name.toLowerCase().includes(query.toLowerCase())
      ),
    [allDocs, filter, query]
  );

  /* ---------- удалить ---------- */
  const deleteRequest = async id => {
    if (!window.confirm("Удалить заявление навсегда?")) return;
    setDeleting(id);
    try {
      const token = getToken();
      await fetch(`http://localhost:4000/api/requests/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchList();
    } catch {
      alert("Не удалось удалить");
    } finally {
      setDeleting(null);
    }
  };

  /* ---------- скачать ---------- */
  const downloadFile = async (idDoc, name) => {
    try {
      const token = getToken();
      const res = await fetch(
        `http://localhost:4000/api/documents/${idDoc}/download`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Не удалось скачать файл");
    }
  };

  /* ---------- UI ---------- */
  const filterOptions = [
    { key: "all", label: "Все" },
    { key: "signed", label: "Подписанные" },
    { key: "pending", label: "Ожидают подписи" },
    { key: "rejected", label: "Отклонено" }
  ];

  return (
    <>
      <Header />

      <main className={styles.main}>
        <section className={styles.card}>
          {/* панель фильтра/поиска */}
          <div className={styles.topBar}>
            <div className={styles.filterBar}>
              {filterOptions.map(f => (
                <button
                  key={f.key}
                  className={`${styles.filterBtn} ${
                    filter === f.key ? styles.active : ""
                  }`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className={styles.searchBox}>
              <input
                type="text"
                placeholder="Поиск …"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <Search size={18} className={styles.searchIcon} />
            </div>
          </div>

          {/* таблица */}
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: "36%" }}>Название</th>
                <th style={{ width: "18%" }}>Дата</th>
                <th style={{ width: "24%" }}>Маршрут</th>
                <th style={{ width: "11%" }}>Статус</th>
                <th>Действие</th>
              </tr>
            </thead>

            <tbody>
              {docs.map(d => {
                const ext = (d.name.split(".").pop() || "").toLowerCase();
                const rowCls = deleting === d.id ? styles.deleting : "";
                const canEdit = d.status !== "signed"; // 🚫 нельзя редактировать, если подписано
                return (
                  <tr key={d.id} className={rowCls}>
                    <td>
                      <button
                        type="button"
                        className={styles.fileLink}
                        onClick={() => downloadFile(d.idDoc, d.name)}
                        title={d.name}
                      >
                        <FileIcon ext={ext} />
                        <span className={styles.fileName}>{d.name}</span>
                        {d.badge ? (
                          <span className={styles.badge}>{d.badge}</span>
                        ) : null}
                      </button>
                    </td>
                    <td>{d.date}</td>
                    <td>
                      <span className={styles.route}>{d.route}</span>
                    </td>
                    <td>
                      <StatusTag s={d.status} />
                    </td>
                    <td>
                      <div className={styles.btnRow}>
                       <button
  className={`${styles.btnSm} ${styles.edit}`}
  onClick={() => {
    if (canEdit) navigate(`/request/${d.id}/edit`);
    else alert("Подписанные документы нельзя редактировать");
  }}
  disabled={!canEdit}
  style={!canEdit ? { opacity: 0.7, cursor: "not-allowed" } : {}}
  title={canEdit ? "Редактировать" : "Нельзя редактировать подписанный документ"}
>
  <Edit size={14} /> Редактировать
</button>

                        <button
                          className={`${styles.btnSm} ${styles.del}`}
                          onClick={() => deleteRequest(d.id)}
                        >
                          <Trash2 size={14} /> Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!docs.length && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center" }}>
                    Ничего не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <button
            className={styles.btnPrimary}
            onClick={() => navigate("/request/new")}
          >
            <Plus size={18} /> Создать заявление на подпись
          </button>
        </section>

        {/* плавающая кнопка "На главную" */}
        <button
          className={styles.fabHome}
          onClick={() => navigate("/dashboard")}
          title="На главную"
        >
          <ArrowLeft size={20} />
        </button>
      </main>
    </>
  );
}
