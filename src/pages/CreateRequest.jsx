import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "./Header";
import styles from "./CreateRequest.module.css";
import { getToken } from "../services/authService";
import { Trash2 } from "lucide-react";

export default function CreateRequest() {
  const navigate = useNavigate();

  /* состояния */
  const [file, setFile] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [keys, setKeys] = useState([]);
  const [keyId, setKeyId] = useState("");
  const [signPassword, setSignPassword] = useState("");
  const [sigError, setSigError] = useState("");
  const [recipientType, setRecipientType] = useState("department"); // department | user
  const [recipientId, setRecipientId] = useState("");
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState({ file: "", recipient: "" });
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState("");

  /* ───────── Подгружаем списки ───────── */
  useEffect(() => {
    const token = getToken();

    // ключи пользователя
    fetch("http://localhost:4000/api/keys", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setKeys(d.keys || []))
      .catch(() => {});

    // отделы
    fetch("http://localhost:4000/api/departments", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setDepartments(d.departments || []))
      .catch(() => {});

    // пользователи
    fetch("http://localhost:4000/api/users", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setUsers(d.users || []))
      .catch(() => {});
  }, []);

  /* очищаем ошибки */
  const clearErrors = () => {
    setErrors({ file: "", recipient: "" });
    setSigError("");
    setGeneralError("");
  };

  const clearFile = () => setFile(null);

  /* ───────── Отправка формы ───────── */
  const handleSubmit = async e => {
    e.preventDefault();
    clearErrors();

    // проверяем выбор ключа и пароль подписи
    if (keys.length === 0) {
      setSigError("У вас нет созданных подписей. Сначала создайте подпись.");
      return;
    }
    if (!keyId) {
      setSigError("Выберите ключ для подписи.");
      return;
    }
    if (!signPassword) {
      setSigError("Введите пароль от подписи.");
      return;
    }

    // проверяем файл и получателя
    let hasErr = false;
    if (!file) {
      setErrors(prev => ({ ...prev, file: "Выберите файл." }));
      hasErr = true;
    }
    if (!recipientId) {
      setErrors(prev => ({ ...prev, recipient: "Укажите получателя." }));
      hasErr = true;
    }
    if (hasErr) return;

    setSubmitting(true);
    try {
      const token = getToken();

      // 1. загрузка файла
      const fd = new FormData();
      fd.append("document", file);
      const docRes = await fetch("http://localhost:4000/api/documents", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      if (!docRes.ok) {
              const err = await docRes.json().catch(()=>({ error: "Ошибка загрузки файла" }));
              throw new Error(err.error || "Ошибка загрузки файла");
      }
      const { document } = await docRes.json();

      // 2. создание заявки с подписью отправителя
      const reqRes = await fetch("http://localhost:4000/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id_document: document.id_document,
          id_recipient_user:
            recipientType === "user" ? Number(recipientId) : null,
          id_recipient_dept:
            recipientType === "department" ? Number(recipientId) : null,
          comment_sender: comment,
          id_key: Number(keyId),
          password: signPassword
        })
      });
      if (!reqRes.ok) {
        const err = await reqRes.json();
        throw new Error(err.error || "Не удалось создать заявку");
      }

      // 3. навигация
      navigate("/dashboard");
    } catch (err) {
      setGeneralError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header />

      <main className={styles.main}>
        <section className={styles.card}>
          {generalError && (
           <div className={styles.errorBox}>{generalError}</div>
         )}
          <h2>Создать заявление на подпись</h2>

          <form onSubmit={handleSubmit} className={styles.form}>
            {/* файл */}
            <div
              className={`${styles.fileField} ${
                errors.file ? styles.hasError : ""
              }`}
            >
              {errors.file && (
                <span className={styles.fieldErrorMsg}>{errors.file}</span>
              )}

              <label className={styles.fileLabel}>
                Файл заявления
                <input
                  type="file"
                  onChange={e => setFile(e.target.files[0] ?? null)}
                />
              </label>

              {file && (
                <div className={styles.selectedFile}>
                  <span className={styles.fileName}>{file.name}</span>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={clearFile}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* подпись отправителя */}
            <div className={`${styles.signBlock} ${sigError ? styles.hasError : ""}`}>
              {keys.length === 0 ? (
                <div className={styles.fieldErrorMsg}>
                  У вас нет созданных подписей. Сначала создайте подпись.
                </div>
              ) : (
                <>
                  <label>
                    Выберите ключ для подписи:
                    <select
                      value={keyId}
                      onChange={e => setKeyId(e.target.value)}
                    >
                      <option value="">-- выберите --</option>
                      {keys.map(k => (
                        <option key={k.id_key} value={k.id_key}>
                          {k.name || k.fingerprint}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Пароль подписи:
                    <input
                      type="password"
                      value={signPassword}
                      onChange={e => setSignPassword(e.target.value)}
                      placeholder="Пароль от закрытого ключа"
                    />
                  </label>
                </>
              )}
              {sigError && (
                <div className={styles.fieldErrorMsg}>{sigError}</div>
              )}
            </div>

            {/* получатель */}
            <div
              className={`${styles.recipientBlock} ${
                errors.recipient ? styles.hasError : ""
              }`}
            >
              {errors.recipient && (
                <span className={styles.fieldErrorMsg}>
                  {errors.recipient}
                </span>
              )}

              <fieldset className={styles.radioBox}>
                <legend>Кому отправить</legend>

                <label>
                  <input
                    type="radio"
                    name="recipientType"
                    value="department"
                    checked={recipientType === "department"}
                    onChange={() => {
                      setRecipientType("department");
                      setRecipientId("");
                    }}
                  />
                  <span>Отдел</span>
                </label>

                <label>
                  <input
                    type="radio"
                    name="recipientType"
                    value="user"
                    checked={recipientType === "user"}
                    onChange={() => {
                      setRecipientType("user");
                      setRecipientId("");
                    }}
                  />
                  <span>Пользователь</span>
                </label>
              </fieldset>

              <select
                className={styles.inputControl}
                value={recipientId}
                onChange={e => setRecipientId(e.target.value)}
              >
                <option value="">-- выберите --</option>
                {(recipientType === "department"
                  ? departments
                  : users
                ).map(item => (
                  <option
                    key={item.id_dept || item.id_user}
                    value={item.id_dept || item.id_user}
                  >
                    {item.name || item.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* комментарий */}
            <label>
              <span className={styles.labelText}>Комментарий</span>
              <textarea
                className={`${styles.inputControl} ${styles.textareaControl}`}
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Комментарий к заявлению"
              />
            </label>

            <div className={styles.actions}>
              <button
                type="submit"
                disabled={submitting}
                className={styles.submitBtn}
              >
                {submitting ? "Сохранение…" : "Отправить на подпись"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </>
  );
}
