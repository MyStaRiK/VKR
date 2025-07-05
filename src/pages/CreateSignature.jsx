/* src/pages/CreateSignature.jsx */
import React, { useEffect, useState } from "react";
import { useNavigate }           from "react-router-dom";
import Header                    from "./Header";
import { getToken, logout }      from "../services/authService";
import styles                    from "./CreateSignature.module.css";

const API = "http://localhost:4000";

export default function CreateSignature() {
  const nav     = useNavigate();
  const token   = getToken();
  useEffect(() => {
      if (!token) nav('/login', { replace: true });
    }, [token, nav]);
  /* ───────── state ───────── */
  const [step, setStep]       = useState(0);          // 0-list | 1-choose | 2-params | 3-done
  const [choice, setChoice]   = useState(null);       // generate | import (импорт пока заглушка)
  const [keys, setKeys]       = useState([]);         // список созданных ключей
  const [name, setName]       = useState("");         // «человеческое» название
  const [pwd , setPwd ]       = useState("");         // пароль для AES-оболочки
  const [pwd2, setPwd2]       = useState("");         // повтор пароля
  const [helpCollapsed, setHelp] = useState(false);

  /* ───────── helpers ───────── */
  const fetchJSON = (url, opts={}) =>
    fetch(url, { ...opts, headers:{ ...(opts.headers||{}), Authorization:`Bearer ${token}` } })
  .then(async r => {
        if (r.ok) return r.json();
        if (r.status === 401) {          // токен протух
          logout();
          nav('/login', { replace: true });
          return;
        }
        const err = await r.json().catch(() => ({}));
        return Promise.reject(new Error(err.error || r.statusText));
      });

  /* ───────── load list ───────── */
  const load = () => fetchJSON(`${API}/api/keys`).then(j=>setKeys(j.keys||[]));
   useEffect(() => {            // вызов = да • return = нет
       load();
     }, [token]);

  /* ───────── создание ключа ───────── */
  const createKey = async () => {
    if (pwd !== pwd2) { alert("Пароли не совпадают"); return false; }
    if (pwd.length < 8) { alert("Пароль должен быть не короче 8 символов"); return false; }

    await fetchJSON(`${API}/api/keys`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ name: name || null, password: pwd })
    });
    await load();
    return true;
  };

  /* ───────── удаление ───────── */
  const deleteKey = id =>
    window.confirm("Удалить этот ключ?") &&
    fetchJSON(`${API}/api/keys/${id}`, { method:"DELETE" }).then(load);

  /* ───────── wizard nav ───────── */
  const next = async () => {
    if (step===2 && choice==="generate") {
      const ok = await createKey();
      if (!ok) return;
    }
    if (step===2 && choice==="import") {
      alert("Импорт усиленных сертификатов появится позже."); return;
    }
    setStep(s=>s+1);
  };
  const back = () => setStep(s=>Math.max(s-1,0));

  /* ───────── render ───────── */
  return (
    <>
      <Header/>
      <main className={styles.main}>
        <div className={styles.card}>

          {/* ===== список ключей ===== */}
          {step===0 && (
            <>
              <h2>Мои ключи подписи</h2>
              {keys.length
                ? <ul className={styles.sigList}>
                    {keys.map(k=>(
                      <li key={k.id_key} className={styles.sigItem}>
                        <span className={styles.sigName}>{k.name||`Key #${k.id_key}`}</span>
                        <span className={styles.sigStatus}>Активен</span>
                        <code style={{fontSize:12}}>{k.fingerprint}</code>
                        <button className={styles.delBtn} onClick={()=>deleteKey(k.id_key)}>Удалить</button>
                      </li>
                    ))}
                  </ul>
                : <p className={styles.empty}>Ключей пока нет.</p>}
              <div className={styles.btnBar} style={{justifyContent:"flex-end"}}>
                <button className={`${styles.btn} ${styles.primary}`} onClick={()=>{setStep(1);setChoice(null);}}>
                  {keys.length? "Добавить ключ":"Создать ключ"}
                </button>
              </div>
            </>
          )}

          {/* ===== мастер ===== */}
          {step>0 && (
            <>
              <h1>Мастер создания ключа</h1>
              <div className={styles.wizardBody}>

                {/* левая колонка (шаги) */}
                <div>
                  <div className={styles.steps}>
                    {[1,2,3].map(i=>(
                      <div key={i} className={`${styles.step} ${step>=i?styles.active:""}`}>
                        <span>{i}</span>
                      </div>
                    ))}
                  </div>

                  {/* step-1 : choose scenario */}
                  {step===1 && (
                    <section className={styles.wizardPage}>
                      <p>Как хотите получить ключ?</p>
                      <div className={styles.optionGrid}>
                        {/* генерация */}
                        <div
                          className={`${styles.option} ${choice==="generate"?styles.selected:""}`}
                          onClick={()=>setChoice("generate")}
                        >
                          <h3>Сгенерировать (простой)</h3>
                          <p>Ключ будет создан на сервере, зашифрован вашим паролем.</p>
                        </div>
                        {/* импорт – заглушка */}
                        <div
                          className={`${styles.option} ${choice==="import"?styles.selected:""}`}
                          onClick={()=>setChoice("import")}
                        >
                          <h3>Импортировать (*.pfx)</h3>
                          <p>Опция появится позже.</p>
                        </div>
                      </div>
                      <div className={styles.btnBar} style={{justifyContent:"flex-end"}}>
                        <button className={`${styles.btn} ${styles.primary}`} disabled={!choice} onClick={next}>Далее</button>
                      </div>
                    </section>
                  )}

                  {/* step-2 : params */}
                  {step===2 && choice==="generate" && (
                    <section className={styles.wizardPage}>
                      <label>Название (необязательно)</label>
                      <input className={styles.input} value={name} onChange={e=>setName(e.target.value)} />

                      <label>Пароль к приватному ключу</label>
                      <input type="password" className={styles.input} value={pwd}  onChange={e=>setPwd(e.target.value)} />
                      <label>Повторите пароль</label>
                      <input type="password" className={styles.input} value={pwd2} onChange={e=>setPwd2(e.target.value)} />

                      <div className={styles.btnBar}>
                        <button className={`${styles.btn} ${styles.secondary}`} onClick={back}>Назад</button>
                        <button className={`${styles.btn} ${styles.primary}`}   onClick={next}>Создать</button>
                      </div>
                    </section>
                  )}

                  {/* step-2 import – заглушка */}
                  {step===2 && choice==="import" && (
                    <section className={styles.wizardPage}>
                      <p>Импорт усиленного сертификата пока не доступен.</p>
                      <div className={styles.btnBar}>
                        <button className={`${styles.btn} ${styles.secondary}`} onClick={back}>Назад</button>
                      </div>
                    </section>
                  )}

                  {/* step-3 : done */}
                  {step===3 && (
                    <section className={styles.wizardPage}>
                      <h3>Ключ создан!</h3>
                      <p>Теперь вы можете подписывать документы.</p>
                      <div className={styles.btnBar}>
                        <button className={`${styles.btn} ${styles.primary}`} onClick={()=>{setStep(0);load();}}>К списку</button>
                        <button className={`${styles.btn} ${styles.secondary}`} onClick={()=>nav("/dashboard")}>На главную</button>
                      </div>
                    </section>
                  )}
                </div>

                {/* правая колонка – help */}
                <aside
                  className={`${styles.helpBox} ${helpCollapsed?styles.collapsed:""}`}
                  onClick={()=>helpCollapsed && setHelp(false)}
                >
                  <h2>Инструкция</h2>
                  <ol>
                    <li>Нажмите <b>«Создать ключ»</b>.</li>
                    <li>Придумайте длинный пароль (≥8&nbsp;симв.) – он защищает приватный ключ.</li>
                    <li>Сохраните резервную копию пароля. Без него восстановить ключ невозможно.</li>
                    <li>Включите 2-ФА, чтобы никто кроме вас не подписал документы.</li>
                  </ol>
                </aside>
                <button className={styles.helpToggle} onClick={()=>setHelp(c=>!c)} title="Инструкция">❔</button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
