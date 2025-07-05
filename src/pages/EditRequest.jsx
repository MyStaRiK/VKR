import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "./Header";
import styles from "./CreateRequest.module.css";  // переиспользуем те же стили
import { getToken } from "../services/authService";
import { Trash2, ArrowLeft } from "lucide-react";

export default function EditRequest() {
  const { id }   = useParams();
  const navigate = useNavigate();

  /* общие списки */
  const [departments, setDepartments] = useState([]);
  const [users,       setUsers]       = useState([]);

  /* состояние формы */
  const [file,         setFile]         = useState(null);      // новый файл
  const [oldFileName,  setOldFileName]  = useState("");        // показ старого
  const [idDocument,   setIdDocument]   = useState(null);      // id текущего документа
  const [recipientType,setRecipientType]= useState("department");
  const [recipientId,  setRecipientId]  = useState("");
  const [comment,      setComment]      = useState("");

  const [errors, setErrors] = useState({ file: "", recipient: "" });
  const [saving, setSaving] = useState(false);

  const token = getToken();

  /* ── загрузка справочников ── */
  useEffect(() => {
    fetch("http://localhost:4000/api/departments", { headers:{Authorization:`Bearer ${token}`} })
      .then(r=>r.json()).then(d=>setDepartments(d.departments||[]));
    fetch("http://localhost:4000/api/users", { headers:{Authorization:`Bearer ${token}`} })
      .then(r=>r.json()).then(d=>setUsers(d.users||[]));
  }, [token]);

  /* ── загрузка самой заявки ── */
  useEffect(() => {
    fetch(`http://localhost:4000/api/requests/${id}`, {
      headers:{ Authorization:`Bearer ${token}` }
    })
      .then(r=>r.json())
      .then(({request})=>{
        if (!request) return navigate("/documents");
        setIdDocument(request.id_document);
        setOldFileName(request.original_name || "");
        if (request.id_recipient_user) {
          setRecipientType("user");
          setRecipientId(String(request.id_recipient_user));
        } else if (request.id_recipient_dept) {
          setRecipientType("department");
          setRecipientId(String(request.id_recipient_dept));
        }
        setComment(request.comment_sender || "");
      })
      .catch(()=>navigate("/documents"));
  }, [id, token, navigate]);

  const clearFile = ()=>setFile(null);
  const clearErrors = ()=>setErrors({file:"", recipient:""});

  /* ── submit ── */
  const handleSubmit = async e => {
    e.preventDefault();
    clearErrors();

    let hasErr=false;
    if (!idDocument && !file) {
      setErrors(p=>({...p,file:"Выберите файл."}));
      hasErr=true;
    }
    if (!recipientId) {
      setErrors(p=>({...p,recipient:"Укажите получателя."}));
      hasErr=true;
    }
    if (hasErr) return;

    setSaving(true);
    try {
      let newDocId = idDocument;

      /* если пользователь заменил файл — сначала загружаем */
      if (file) {
        const fd = new FormData();
        fd.append("document", file);
        const up = await fetch("http://localhost:4000/api/documents", {
          method:"POST",
          headers:{ Authorization:`Bearer ${token}` },
          body: fd
        });
        if (!up.ok) throw new Error();
        const {document} = await up.json();
        newDocId = document.id_document;
      }

      /* PATCH/PUT заявки */
      await fetch(`http://localhost:4000/api/requests/${id}`, {
        method:"PUT",
        headers:{
          "Content-Type":"application/json",
          Authorization:`Bearer ${token}`
        },
        body: JSON.stringify({
          id_document:       newDocId,
          id_recipient_user: recipientType==="user"       ? Number(recipientId) : null,
          id_recipient_dept: recipientType==="department" ? Number(recipientId) : null,
          comment_sender:    comment
        })
      });

      navigate("/documents");
    } catch {
      alert("Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  };

  /* ── JSX ── (тот же, что и в CreateRequest, только показывает старый файл) */
  return (
    <>
      <Header />
      <main className={styles.main}>
        <section className={styles.card}>
          <h2>Редактировать заявление</h2>
          <form onSubmit={handleSubmit} className={styles.form}>

            {/* файл */}
            <div className={`${styles.fileField} ${errors.file ? styles.hasError : ""}`}>
              {errors.file && <span className={styles.fieldErrorMsg}>{errors.file}</span>}

              <label className={styles.fileLabel}>
                Заменить файл
                <input type="file" onChange={e=>setFile(e.target.files[0]||null)}/>
              </label>

              {file
                ? (<div className={styles.selectedFile}>
                    <span className={styles.fileName}>{file.name}</span>
                    <button type="button" className={styles.removeBtn} onClick={clearFile}>
                      <Trash2 size={16}/>
                    </button>
                  </div>)
                : oldFileName && (
                  <div className={styles.selectedFile} style={{opacity:.6}}>
                    <span className={styles.fileName}>{oldFileName}</span>
                  </div>
                )
              }
            </div>

            {/* получатель (как в CreateRequest) */}
            <div className={`${styles.recipientBlock} ${errors.recipient ? styles.hasError : ""}`}>
              {errors.recipient && <span className={styles.fieldErrorMsg}>{errors.recipient}</span>}
              <fieldset className={styles.radioBox}>
                {/* radio options … */}
                <label>
                  <input type="radio" name="rt" value="department"
                    checked={recipientType==="department"}
                    onChange={()=>{setRecipientType("department");setRecipientId("");}}/>
                  <span>Отдел</span>
                </label>
                <label>
                  <input type="radio" name="rt" value="user"
                    checked={recipientType==="user"}
                    onChange={()=>{setRecipientType("user");setRecipientId("");}}/>
                  <span>Пользователь</span>
                </label>
              </fieldset>

              <select className={styles.inputControl}
                      value={recipientId}
                      onChange={e=>setRecipientId(e.target.value)}>
                <option value="">-- выберите --</option>
                {(recipientType==="department"?departments:users).map(it=>(
                  <option key={it.id_dept||it.id_user} value={it.id_dept||it.id_user}>
                    {it.name || it.full_name}
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
                onChange={e=>setComment(e.target.value)}
                placeholder="Комментарий к заявлению"
              />
            </label>

            <div className={styles.actions}>
              <button type="submit" disabled={saving} className={styles.submitBtn}>
                {saving ? "Сохранение…" : "Сохранить изменения"}
              </button>
            </div>
          </form>
        </section>
        <button
            type="button"
            className={styles.fabBack}
            onClick={() => navigate("/documents")}
            title="К списку заявок"
        >
            <ArrowLeft size={20}/>
            <span className={styles.fabLabel}>Назад</span>
        </button>
      </main>
    </>
  );
}
