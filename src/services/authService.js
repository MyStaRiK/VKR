const API_BASE = 'http://localhost:4000';

/**
 * Register a new user
 * @param {{full_name: string, email: string, password: string, id_group?: number, telephone?: string, id_role?: number, id_signature?: number}} data
 * @returns {Promise<object>} user
 */
export async function register(data) {
  // Сначала регистрируем пользователя
  const response = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Registration failed');
  }
  // Затем сразу авторизуемся
  const { user } = await response.json();
  const loginData = await login({ email: data.email, password: data.password });
  // Сохраняем токен (если логика такая же как в login)
  if (loginData.token) localStorage.setItem('authToken', loginData.token);
  return { user, ...loginData };
}


/**
 * Login existing user
 * @param {{email: string, password: string}} credentials
 * @returns {Promise<{user: object, token: string}>}
 */
export async function login({ email, password }) {
  const r = await fetch(`${API_BASE}/login`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ email, password })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Login failed');
  return data;               // {need_otp,tmp_token}  ИЛИ  {token,user}
}

export async function verifyOtp(code, tmpToken){
  const r = await fetch(`${API_BASE}/login/otp`,{
    method:'POST',
    headers:{'Content-Type':'application/json',
             Authorization:`Bearer ${tmpToken}`},
    body:JSON.stringify({ code })
  });
  const data = await r.json();
  if(!r.ok) throw new Error(data.error || 'OTP fail');
  return data;               // {token,user}
}

/**
 * Logout user
 */
export function logout() {
  localStorage.removeItem('authToken');
  document.cookie = 'id_user=; Max-Age=0; path=/;';
}

/**
 * Get stored token
 * @returns {string|null}
 */
export function getToken() {
  return localStorage.getItem('authToken');
}
