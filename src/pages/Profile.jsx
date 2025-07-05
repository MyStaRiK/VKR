import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "./Header";
import {
  Edit3, CheckCircle, X, Home,
  Shield, ShieldOff
} from "lucide-react";
import {
  getProfile, updateProfile,
  enable2FA, verify2FA, disable2FA
} from "../services/profileService";
import styles from "./Profile.module.css";

export default function Profile() {
  const nav = useNavigate();

  /* ─── state ─── */
  const [user,setUser]       = useState(null);
  const [groups,setGroups]   = useState([]);
  const [roles,setRoles]     = useState([]);
  const [edit,setEdit]       = useState(false);
  const [form,setForm]       = useState({full_name:"",telephone:"",id_group:"",id_role:""});
  const [err,setErr]         = useState("");
  const [busy,setBusy]       = useState(true);
  const [saving,setSaving]   = useState(false);
  const [success,setSuccess] = useState(false);
  /* 2-FA */
  const [qr,setQr]           = useState("");
  const [code,setCode]       = useState("");
  const [faErr,setFaErr]     = useState("");

  /* ─── load ─── */
  useEffect(()=>{
    getProfile()
      .then(u=>{
        setUser(u);
        setForm({
          full_name:u.full_name,
          telephone:u.telephone||"",
          id_group :u.id_group ||"",
          id_role  :u.id_role  ||""
        });
      })
      .catch(()=>setErr("Ошибка профиля"))
      .finally(()=>setBusy(false));

    const t = localStorage.getItem("authToken");
    fetch("http://localhost:4000/api/groups",{headers:{Authorization:`Bearer ${t}`}})
      .then(r=>r.json()).then(d=>setGroups(d.groups||[]));
    fetch("http://localhost:4000/api/roles",{headers:{Authorization:`Bearer ${t}`}})
      .then(r=>r.json()).then(d=>setRoles(d.roles||[]));
  },[]);

  /* ─── save ─── */
  const save=()=>{
    setSaving(true);setErr("");
    updateProfile(form)
      .then(u=>{
      setUser(u);
      setEdit(false);
      setSuccess(true); 
      setTimeout(()=>setSuccess(false), 2000);
    })
      .catch(()=>setErr("Не удалось сохранить"))
      .finally(()=>setSaving(false));
  };

  /* ─── 2-FA ─── */
  const start2FA = ()=>enable2FA().then(uri=>{setQr(uri);setFaErr("");})
                                  .catch(e=>setFaErr(e.message));
  const confirm2FA = ()=>verify2FA(code)
      .then(()=>getProfile().then(u=>setUser(u)))
      .then(()=>{setQr("");setCode("");})
      .catch(e=>setFaErr(e.message));
  const off2FA = ()=>window.confirm("Отключить 2-FA?") &&
      disable2FA().then(()=>getProfile().then(u=>setUser(u)))
                   .catch(e=>alert(e.message));

  /* ─── render ─── */
  if(busy) return(<><Header/><div className={styles.loader}><div/></div></>);
  if(!user) return(<><Header/><p className={styles.errorBox}>Профиль недоступен</p></>);

  const is2fa   = Number(user.otp_enabled) === 1;
  const initials= user.full_name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
  const groupName=groups.find(g=>g.id_group===user.id_group)?.name||"-";
  const roleName =roles.find(r=>r.id_role ===user.id_role )?.name||"-";

  return(
    <>
      <Header/>
      <main className={styles.main}>
        <div className={styles.flexRow}>
          {/* основная карточка */}
          <section className={styles.card}>
            <div className={styles.header}>
              <div className={styles.avatar}>{initials}</div>
              <h2>{user.full_name}</h2>

              {!edit && (
                <button className={styles.homeBtn} onClick={()=>nav("/dashboard")}>
                  <Home size={16}/> На главную
                </button>
              )}

              {edit ? (
                <div className={styles.editActions}>
                  <button className={styles.saveBtn} onClick={save}>
                    <CheckCircle size={16}/> Сохранить
                  </button>
                  <button className={styles.cancelBtn}
                          onClick={()=>{setEdit(false);setForm({
                            full_name:user.full_name,
                            telephone:user.telephone||"",
                            id_group:user.id_group||"",
                            id_role:user.id_role||""
                          });}}>
                    <X size={16}/> Отмена
                  </button>
                </div>
              ) : (
                <button className={styles.editBtn} onClick={()=>setEdit(true)}>
                  <Edit3 size={16}/> Редактировать
                </button>
              )}

              <p className={styles.role}>{roleName}</p>
            </div>

            {err && <div className={styles.errorBox}>{err}</div>}

            <dl className={styles.infoList}>
              <dt>ФИО</dt>
              <dd>{edit
                   ?<input className={styles.inputField}
                           name="full_name"
                           value={form.full_name}
                           onChange={e=>setForm(f=>({...f,full_name:e.target.value}))}/>
                   :user.full_name}</dd>

              <dt>E-mail</dt><dd>{user.email}</dd>

              <dt>Телефон</dt>
              <dd>{edit
                   ?<input className={styles.inputField}
                           name="telephone"
                           value={form.telephone}
                           onChange={e=>setForm(f=>({...f,telephone:e.target.value}))}/>
                   :user.telephone||"-"}</dd>

              <dt>Группа</dt>
              <dd>{edit
                   ?<select className={styles.inputSelect}
                            name="id_group"
                            value={form.id_group}
                            onChange={e=>setForm(f=>({...f,id_group:e.target.value}))}>
                      <option value="">—</option>
                      {groups.map(g=><option key={g.id_group} value={g.id_group}>{g.name}</option>)}
                    </select>
                   :groupName}</dd>

              <dt>Роль</dt>
              <dd>{edit
                   ?<select className={styles.inputSelect}
                            name="id_role"
                            value={form.id_role}
                            onChange={e=>setForm(f=>({...f,id_role:e.target.value}))}>
                      <option value="">—</option>
                      {roles.map(r=><option key={r.id_role} value={r.id_role}>{r.name}</option>)}
                    </select>
                   :roleName}</dd>
            </dl>
          </section>

          {/* отдельная карточка для 2-FA */}
<section className={styles.card2fa}>
  {is2fa ? (
    <>
      <div className={styles.faStatus}>
        <Shield size={26} />
        <span>Двухфакторная защита подключена</span>
      </div>

      <button className={styles.faOff} onClick={off2FA}>
        Отключить&nbsp;2-FA
      </button>
    </>
  ) : qr ? (
    <div className={styles.faSetup}>
      <img
        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qr)}`}
        alt="QR"
      />

      <input
        className={styles.inputField}
        placeholder="Код из приложения"
        value={code}
        onChange={e => setCode(e.target.value)}
      />

      <button className={styles.faConfirm} onClick={confirm2FA}>
        Подтвердить
      </button>

      {faErr && <p className={styles.faErr}>{faErr}</p>}
    </div>
  ) : (
    <>
      <h3>Двухфакторная аутентификация</h3>
      <button className={styles.faEnable} onClick={start2FA}>
        Включить&nbsp;2-FA
      </button>
    </>
  )}
</section>
        </div>
      </main>

      {saving && <div className={styles.loader}><div/></div>}
       {success && (
   <div className={styles.successOverlay}>
     <CheckCircle size={48} className={styles.successIcon}/>
     <p>Данные обновлены</p>
   </div>
   )}
    </>
  );
}
