import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// ⬇️ Страницы‑контейнеры. Пока что это заглушки, позже добавим их содержимое
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import CreateSignature from "./pages/CreateSignature";
import Signature from "./pages/Signature";
import Profile from "./pages/Profile";
import CreateRequest from "./pages/CreateRequest";
import EditRequest from "./pages/EditRequest";
import Journal from "./pages/AuditLog";
/**
 * Корневой компонент приложения.
 * Здесь настраиваем глобальный роутинг и (при желании) общие провайдеры —
 * контекст аутентификации, React‑Query, Redux, ThemeProvider и т. д.
 */
function App() {
  return (
    <Router>
      {/* TODO: добавить глобальный Layout с header/sidebar, если потребуется */}
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />

        {/* Основные экраны */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/request/new" element={<CreateRequest />} />
        {/* Подписи */}
        <Route path="/signature/new" element={<CreateSignature />} />
        <Route path="/signature" element={<Signature />} />
        <Route path="/request/:id/edit" element={<EditRequest />} />
        <Route path="/profile" element={<Profile/>}/>
        <Route path="/journal" element={<Journal/>}/>
        {/* Fallback */}
        <Route path="*" element={<h1 style={{textAlign:"center",marginTop:"20vh"}}>404 — страница не найдена</h1>} />
      </Routes>
    </Router>
  );
}

export default App;
