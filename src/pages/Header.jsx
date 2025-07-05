import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, Sun, Moon, LogOut, User, Menu as Burger, X } from "lucide-react";
import styles from "./Header.module.css";

export default function Header() {
  const [light, setLight] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  // Закрытие сайдбара по клику вне меню или на esc
  useEffect(() => {
    if (!sidebarOpen) return;
    const handle = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
      // Если клик по фону
      if (e.target.classList?.contains(styles.sidebarOverlay)) setSidebarOpen(false);
    };
    window.addEventListener("keydown", handle);
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      window.removeEventListener("keydown", handle);
      document.body.style.overflow = "";
    };
  }, [sidebarOpen, styles.sidebarOverlay]);

  useEffect(() => {
    document.documentElement.classList.toggle("theme-light", light);
  }, [light]);

  // пункты меню
  const navLinks = [
    { to: "/documents", label: "Документы", active: location.pathname.startsWith("/documents") },
    { to: "/signature", label: "Подписи", active: location.pathname === "/signature" },
    { to: "/signature/new", label: "Мои подписи", active: location.pathname === "/signature/new" },
    { to: "/journal", label: "Журнал", active: location.pathname.startsWith("/journal") }
  ];

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        {/* Мобильный бургер — только на мобилке */}
        <button
          className={styles.burger}
          aria-label="Открыть меню"
          onClick={() => setSidebarOpen(true)}
        >
          <Burger size={26} />
        </button>

        <div className={styles.brand}>
          <Link to="/dashboard">ЭЦП-портал</Link>
        </div>
        {/* Десктоп-меню (горизонтальное) */}
        <ul className={styles.menu}>
          {navLinks.map(link => (
            <li key={link.to}>
              <Link
                to={link.to}
                className={link.active ? styles.active : ""}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        {/* Десктоп/мобильные actions */}
        <div className={styles.actions}>
          <button className={styles.iconBtn} title="Уведомления">
            <Bell size={20} />
          </button>
          <label className={styles.themeToggle} title="Тёмная / светлая тема">
            <input
              type="checkbox"
              checked={light}
              onChange={e => setLight(e.target.checked)}
            />
            <span className={styles.track} />
            <span className={styles.thumb} />
            <Sun className={styles.sun} size={14} />
            <Moon className={styles.moon} size={14} />
          </label>
          <div className={styles.profile} tabIndex={0}>
            <User size={20} />
            <div className={styles.profileMenu}>
              <Link to="/profile" className={styles.menuLink}>
                <User size={16} /> Профиль
              </Link>
              <button onClick={() => navigate("/login")}>
                <LogOut size={16} /> Выход
              </button>
            </div>
          </div>
        </div>
      </nav>
      {/* Сайдбар для мобилки */}
      {sidebarOpen && (
        <div
          className={styles.sidebarOverlay}
          onClick={e => {
            if (e.target.classList.contains(styles.sidebarOverlay)) setSidebarOpen(false);
          }}
        >
          <aside className={styles.sidebar}>
            <button
              className={styles.sidebarClose}
              onClick={() => setSidebarOpen(false)}
              aria-label="Закрыть меню"
            >
              <X size={28} />
            </button>
            <ul className={styles.sidebarMenu}>
              {navLinks.map(link => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className={link.active ? styles.active : ""}
                    onClick={() => setSidebarOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </header>
  );
}
