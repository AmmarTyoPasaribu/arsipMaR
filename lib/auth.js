import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'arsipmar-secret-key-2024';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '365d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Client-side utilities
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

export function getUserFromToken() {
  const token = getToken();
  if (!token) return null;
  try {
    const decoded = jwt.decode(token);
    if (!decoded) return null;
    // Check expiry
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      removeToken();
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
