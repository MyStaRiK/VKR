// src/services/profileService.js

import { getToken } from './authService';

const API_BASE = 'http://localhost:4000';

/**
 * Fetch the current user's profile
 * @returns {Promise<object>} user
 */
export async function getProfile() {
  const token = getToken();
  const response = await fetch(`${API_BASE}/api/profile`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to fetch profile');
  }
  const { user } = await response.json();
  return user;
}

/**
 * Update the current user's profile
 * @param {{full_name: string, id_group?: string|number, telephone?: string, id_role?: string|number}} data
 * @returns {Promise<object>} updated user
 */
export async function updateProfile(data) {
  const token = getToken();

  // Преобразуем id_group и id_role: пустые строки → null, иначе число
  const body = {
    full_name: data.full_name,
    telephone: data.telephone,
    id_group: data.id_group === '' ? null : Number(data.id_group),
    id_role:  data.id_role  === '' ? null : Number(data.id_role),
  };

  const response = await fetch(`${API_BASE}/api/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to update profile');
  }
  const { user } = await response.json();
  return user;
}

/* ---------- 2-FA ---------- */
export async function enable2FA() {
  const r = await fetch(`${API_BASE}/api/2fa/enable`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  if (!r.ok) throw new Error("Не удалось сгенерировать 2-FA");
  return (await r.json()).otpauth;           // otpauth:// URI
}

export async function verify2FA(code) {
  const r = await fetch(`${API_BASE}/api/2fa/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify({ code })
  });
  if (!r.ok) throw new Error("Неверный код");
  return true;
}

export async function disable2FA() {
  const r = await fetch(`${API_BASE}/api/2fa/disable`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  if (!r.ok) throw new Error("Ошибка отключения");
  return true;
}
