// Signature.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Header from "./Header";
import { getToken } from "../services/authService";
import { ArrowLeft } from "lucide-react";
import styles from "./Signature.module.css";

const colorByExt = {
  pdf: "#EF4444",
  doc: "#3B82F6",
  docx: "#3B82F6",
  xls: "#22C55E",
  xlsx: "#22C55E"
};
const pickColor = ext => colorByExt[ext] || "#9CA3AF";

const StatusTag = ({ st }) => (
  <span className={`${styles.status} ${styles[st]}`}>
    {st === "pending" ? "Ожидает" : st === "signed" ? "Подписан" : "Отклонён"}
  </span>
);

export default function Signature() {
  const navigate = useNavigate();
  const token = getToken();

  const [all, setAll] = useState([]);
  const [keys, setKeys] = useState([]);
  const [tab, setTab] = useState("pending");

  const [signingId, setSigningId] = useState(null);
  const [keyId, setKeyId] = useState("");
  const [signPassword, setSignPassword] = useState("");
  const [sigError, setSigError] = useState("");
  const [generalError, setGeneralError] = useState("");

  const hasKeys = keys.length > 0;

  /* ───── загрузка входящих и ключей ───── */
  const load = () => {
    fetch("http://localhost:4000/api/incoming-requests", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        const tasks = (d.tasks || []).map(t => ({
          id: t.id_request,
          idDoc: t.id_document,
          name: t.original_name,
          sender: t.sender_name,
          date: new Date(t.created_at).toLocaleDateString(),
          status: /подпис/i.test(t.status)
            ? "signed"
            : /отклон/i.test(t.status)
            ? "rejected"
            : "pending"
        }));
        setAll(tasks);
      })
      .catch(() => setAll([]));

    fetch("http://localhost:4000/api/keys", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setKeys(d.keys || []))
      .catch(() => setKeys([]));
  };

  useEffect(load, [token]);

  const tasks = useMemo(
    () => all.filter(t => (tab === "all" ? true : t.status === tab)),
    [all, tab]
  );

  /* ───── старт ввода подписи ───── */
  const startSigning = id => {
    if (!hasKeys) {
      setGeneralError("У вас ещё нет созданных подписей — сначала создайте ключ.");
      return;
    }
    setSigningId(id);
    setKeyId("");
    setSignPassword("");
    setSigError("");
    setGeneralError("");
  };
  const cancelSigning = () => setSigningId(null);

  /* ───── отправка подписи ───── */
  const submitSign = async id => {
    if (!keyId)          return setSigError("Выберите ключ.");
    if (!signPassword)   return setSigError("Введите пароль.");
    try {
      const res = await fetch(`http://localhost:4000/api/requests/${id}/sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id_key: Number(keyId), password: signPassword })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Ошибка подписи" }));
        throw new Error(err.error);
      }
      setSigningId(null);
      load();
    } catch (e) {
      setSigError(e.message);
    }
  };

  /* ───── отклонить заявку ───── */
  const rejectRequest = async id => {
    try {
      const res = await fetch(`http://localhost:4000/api/requests/${id}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Ошибка отклонения" }));
        throw new Error(err.error);
      }
      load();
    } catch (e) {
      setGeneralError(e.message);
    }
  };

  return (
    <>
      <Header />
      <main className={styles.main}>
        <section className={styles.card}>
          {generalError && <div className={styles.errorBox}>{generalError}</div>}

          {!hasKeys && (
            <div className={styles.infoBox}>
              Подпись отсутствует — создать можно в разделе «Мои Подписи».
            </div>
          )}

          <h2>
            Задачи на подпись{" "}
            <span className={styles.badge}>
              {all.filter(t => t.status === "pending").length}
            </span>
          </h2>

          <div className={styles.tabs}>
            {[
              { key: "pending", label: "Ожидают" },
              { key: "signed", label: "Подписанные" },
              { key: "rejected", label: "Отклонённые" }
            ].map(t => (
              <button
                key={t.key}
                className={`${styles.tabBtn} ${tab === t.key ? styles.active : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: "38%" }}>Документ</th>
                <th style={{ width: "22%" }}>Отправитель</th>
                <th style={{ width: "14%" }}>Дата</th>
                <th style={{ width: "12%" }}>Статус</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => {
                const ext = (t.name.split(".").pop() || "").toLowerCase();

                /* режим ввода пароля */
                if (t.id === signingId) {
                  return (
                    <tr key={t.id}>
                      <td colSpan={5}>
                        <div className={styles.signForm}>
                          <label className={styles.inputGroup}>
                            Ключ:
                            <select value={keyId} onChange={e => setKeyId(e.target.value)}>
                              <option value="">-- выберите --</option>
                              {keys.map(k => (
                                <option key={k.id_key} value={k.id_key}>
                                  {k.name || k.fingerprint}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={styles.inputGroup}>
                            Пароль:
                            <input
                              type="password"
                              value={signPassword}
                              onChange={e => setSignPassword(e.target.value)}
                              placeholder="Пароль"
                            />
                          </label>
                          {sigError && <div className={styles.fieldErrorMsg}>{sigError}</div>}
                          <div className={styles.btnRow}>
                            <button
                              className={`${styles.btn} ${styles.btnSign}`}
                              onClick={() => submitSign(t.id)}
                            >
                              Подтвердить
                            </button>
                            <button
                              className={`${styles.btn} ${styles.btnDecline}`}
                              onClick={cancelSigning}
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={t.id}>
                    <td>
                      <button
                        className={styles.fileLink}
                        onClick={() =>
                          fetch(
                            `http://localhost:4000/api/documents/${t.idDoc}/download`,
                            { headers: { Authorization: `Bearer ${token}` } }
                          )
                            .then(r => r.blob())
                            .then(blob => {
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = t.name;
                              a.click();
                              URL.revokeObjectURL(url);
                            })
                        }
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={pickColor(ext)}>
                          <path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1-2-2Zm7 1.5V8h4.5" />
                        </svg>
                        {t.name}
                      </button>
                    </td>
                    <td>{t.sender}</td>
                    <td>{t.date}</td>
                    <td><StatusTag st={t.status} /></td>
                    <td>
                      {t.status === "pending" && (
                        <div className={styles.btnRow}>
                          <button
                            className={`${styles.btn} ${styles.btnSign} ${!hasKeys && styles.disabled}`}
                            onClick={() => startSigning(t.id)}
                            disabled={!hasKeys}
                          >
                            Подписать
                          </button>
                          <button
                            className={`${styles.btn} ${styles.btnDecline}`}
                            onClick={() => rejectRequest(t.id)}
                          >
                            Отказать
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!tasks.length && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center" }}>
                    Пусто
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <button className={styles.fabBack} onClick={() => navigate("/dashboard")}>
          <ArrowLeft size={20} /> Назад
        </button>
      </main>
    </>
  );
}
