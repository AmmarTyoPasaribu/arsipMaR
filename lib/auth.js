// Client-side token utilities (server-side signing/verification lives in lib/jwt.js)
export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('arsipmar_token');
}

export function setToken(token) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('arsipmar_token', token);
}

export function removeToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('arsipmar_token');
}

function decodePayload(token) {
  const part = token.split('.')[1];
  if (!part) return null;
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(b64).split('').map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
  );
  return JSON.parse(json);
}

// Decodes only (no signature check) - fine for UI gating, not for authorization.
export function getUserFromToken() {
  const token = getToken();
  if (!token) return null;
  try {
    const decoded = decodePayload(token);
    if (!decoded?.id) return null;
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      removeToken();
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
