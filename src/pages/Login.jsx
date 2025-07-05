// Login.jsx
import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import {
  login as loginService,
  verifyOtp as verifyOtpService,
  register as registerService
} from "../services/authService";
import styles from "./Login.module.css";

/* ───────── Field helper ───────── */
function Field({
  label,
  name,
  type = "text",
  placeholder = "",
  required = false,
  show,
  toggleShow
}) {
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const isPassword = type === "password";

  const handleInvalid = e => {
    e.preventDefault();
    const v = e.target.validity;
    const msg = v.valueMissing
      ? "Поле обязательно"
      : v.typeMismatch && type === "email"
      ? "Некорректный e-mail"
      : "Некорректное значение";
    setError(msg);
    const input = e.target;
    input.classList.add(styles.hasError, styles.shake);
    setTimeout(() => input.classList.remove(styles.shake), 600);
  };

  const handleInput = e => {
    if (error) setError("");
    e.target.classList.remove(styles.hasError);
  };

  return (
    <label className={`${styles.field} ${error ? styles.hasError : ""}`}>
      {label}
      {isPassword ? (
        <div className={styles.passwordWrap}>
          <input
            ref={inputRef}
            name={name}
            type={show ? "text" : "password"}
            required={required}
            placeholder={placeholder}
            onInvalid={handleInvalid}
            onInput={handleInput}
            autoComplete="current-password"
          />
          <button
            type="button"
            className={styles.toggle}
            onClick={toggleShow}
            aria-label={show ? "Скрыть пароль" : "Показать пароль"}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      ) : (
        <input
          ref={inputRef}
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          onInvalid={handleInvalid}
          onInput={handleInput}
          autoComplete="off"
        />
      )}
      {error && <span className={styles.error}>{error}</span>}
    </label>
  );
}

/* ───────── Компонент ───────── */
export default function Login() {
  const [mode, setMode] = useState("login"); // login | otp | register | forgot | info
  const [showPassLogin, setShowPassLogin] = useState(false);
  const [showPassReg1, setShowPassReg1] = useState(false);
  const [showPassReg2, setShowPassReg2] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [tmpToken, setTmpToken] = useState(null); // хранит JWT стадии OTP
  const navigate = useNavigate();

  const setUserCookie = id => {
    document.cookie = `id_user=${id}; path=/;`;
  };

  const clearError = () => {
    setErrorMsg("");
    setInfoMsg("");
  };

  const backToLogin = () => {
    clearError();
    setMode("login");
  };

  /* ───────── LOGIN (этап 1) ───────── */
  const handleLogin = async e => {
    e.preventDefault();
    clearError();
    setLoading(true);
    const form = e.target;
    if (!form.checkValidity()) {
      form.classList.add(styles.wasValidated);
      setLoading(false);
      return;
    }
    try {
      const res = await loginService({
        email: form.email.value,
        password: form.password.value
      });
      if (res.need_otp) {
        setTmpToken(res.tmp_token);
        setMode("otp"); // переключаемся на ввод кода
      } else {
        localStorage.setItem("authToken", res.token);
        const user = res.user || res;
        setUserCookie(user.id_user);
        navigate("/dashboard");
      }
    } catch (err) {
      setErrorMsg(err.message);
      form.email.classList.add(styles.hasError, styles.shake);
      setTimeout(() => form.email.classList.remove(styles.shake), 600);
    } finally {
      setLoading(false);
    }
  };

  /* ───────── LOGIN (этап 2: OTP) ───────── */
  const handleOtp = async e => {
    e.preventDefault();
    clearError();
    setLoading(true);
    const form = e.target;
    try {
      const res = await verifyOtpService(form.code.value, tmpToken);
      localStorage.setItem("authToken", res.token);
      const user = res.user || res;
      setUserCookie(user.id_user);
      navigate("/dashboard");
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ───────── REGISTER ───────── */
  const handleRegister = async e => {
    e.preventDefault();
    clearError();
    setLoading(true);
    const form = e.target;
    if (!form.checkValidity()) {
      form.classList.add(styles.wasValidated);
      setLoading(false);
      return;
    }
    if (form.regPass1.value !== form.regPass2.value) {
      setErrorMsg("Пароли не совпадают");
      [form.regPass1, form.regPass2].forEach(input => {
        input.classList.add(styles.hasError, styles.shake);
        setTimeout(() => input.classList.remove(styles.shake), 600);
      });
      setLoading(false);
      return;
    }
    try {
      const res = await registerService({
        full_name: form.fullname.value,
        email: form.regEmail.value,
        password: form.regPass1.value
      });
      const newUser = res.user || res;
      setUserCookie(newUser.id_user);
      navigate("/dashboard");
    } catch (err) {
      setErrorMsg(err.message);
      if (err.message.includes("email")) {
        form.regEmail.classList.add(styles.hasError, styles.shake);
        setTimeout(() => form.regEmail.classList.remove(styles.shake), 600);
      }
    } finally {
      setLoading(false);
    }
  };

  /* ───────── FORGOT ───────── */
  const handleForgot = e => {
    e.preventDefault();
    clearError();
    setInfoMsg("Функция сброса пароля в разработке.");
    setMode("info");
  };

  /* ───────── LOADER / INFO ───────── */
  const Loader = loading && (
    <div className={styles.loaderOverlay}>
      <div className={styles.spinner} />
    </div>
  );

  const InfoScreen = (
    <div className={styles.infoScreen} onClick={backToLogin}>
      <div className={styles.infoBox}>
        <p>{infoMsg}</p>
        <button className={styles.primary} onClick={backToLogin}>
          OK
        </button>
      </div>
    </div>
  );

  /* ───────── ШАБЛОНЫ ФОРМ ───────── */
  const LoginForm = (
    <>
      <h2>Вход</h2>
      {errorMsg && <span className={styles.error}>{errorMsg}</span>}
      <form onSubmit={handleLogin} onInput={clearError} noValidate>
        <Field
          label="E-mail"
          name="email"
          type="email"
          placeholder="user@example.com"
          required
          show={false}
          toggleShow={() => {}}
        />
        <Field
          label="Пароль"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          show={showPassLogin}
          toggleShow={() => setShowPassLogin(v => !v)}
        />
        <label className={styles.remember}>
          <input type="checkbox" name="remember" /> Запомнить меня
        </label>
        <div className={styles.actions}>
          <button type="submit" className={styles.primary}>
            Войти
          </button>
        </div>
      </form>
      <div className={styles.links}>
        <button onClick={() => setMode("forgot")}>Забыли пароль?</button> /{" "}
        <button onClick={() => setMode("register")}>Регистрация</button>
      </div>
    </>
  );

  const OtpForm = (
    <>
      <h2>Двухфакторная проверка</h2>
      {errorMsg && <span className={styles.error}>{errorMsg}</span>}
      <form onSubmit={handleOtp} onInput={clearError} noValidate>
        <Field
          label="Код из приложения"
          name="code"
          type="text"
          placeholder="123 456"
          required
        />
        <div className={styles.actions}>
          <button type="submit" className={styles.primary}>
            Подтвердить
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={backToLogin}
          >
            Назад
          </button>
        </div>
      </form>
    </>
  );

  const RegisterForm = (
    <>
      <h2>Регистрация</h2>
      {errorMsg && <span className={styles.error}>{errorMsg}</span>}
      <form onSubmit={handleRegister} onInput={clearError} noValidate>
        <Field
          label="E-mail"
          name="regEmail"
          type="email"
          required
          show={false}
          toggleShow={() => {}}
        />
        <Field
          label="Полное ФИО"
          name="fullname"
          required
          show={false}
          toggleShow={() => {}}
        />
        <Field
          label="Пароль"
          name="regPass1"
          type="password"
          placeholder="••••••••"
          required
          show={showPassReg1}
          toggleShow={() => setShowPassReg1(v => !v)}
        />
        <Field
          label="Повторите пароль"
          name="regPass2"
          type="password"
          placeholder="••••••••"
          required
          show={showPassReg2}
          toggleShow={() => setShowPassReg2(v => !v)}
        />
        <div className={styles.actions}>
          <button type="submit" className={styles.primary}>
            Создать
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={backToLogin}
          >
            Назад
          </button>
        </div>
      </form>
    </>
  );

  const ForgotForm = (
    <>
      <h2>Сброс пароля</h2>
      {errorMsg && <span className={styles.error}>{errorMsg}</span>}
      <form onSubmit={handleForgot} onInput={clearError} noValidate>
        <Field
          label="E-mail"
          name="forgotEmail"
          type="email"
          required
          show={false}
          toggleShow={() => {}}
        />
        <div className={styles.actions}>
          <button type="submit" className={styles.primary}>
            Сбросить
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={backToLogin}
          >
            Назад
          </button>
        </div>
      </form>
    </>
  );

  /* ───────── рендер по mode ───────── */
  let current;
  if (mode === "register") current = RegisterForm;
  else if (mode === "forgot") current = ForgotForm;
  else if (mode === "otp") current = OtpForm;
  else if (mode === "info") current = InfoScreen;
  else current = LoginForm;

  return (
    <main className={styles.screen}>
      {Loader}
      <section className={styles.card}>
        <div key={mode} className={styles.container}>
          {current}
        </div>
      </section>
    </main>
  );
}
