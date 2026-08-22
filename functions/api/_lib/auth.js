// ========================================
// 🔐 ابزارهای احراز هویت مشترک
// همه‌ی endpoint های محافظت‌شده از این فایل استفاده می‌کنند
// تا هویت کاربر از روی توکن تایید بشه، نه از روی id ای که کلاینت
// خودش تو body/query می‌فرسته.
// ========================================

const encoder = new TextEncoder();

function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}
function toBase64Url(buf) {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---------- هش کردن رمز عبور (PBKDF2-SHA256) ----------
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return `${toHex(salt)}:${toHex(bits)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [saltHex, hashHex] = stored.split(':');
  const salt = fromHex(saltHex);
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return toHex(bits) === hashHex;
}

// ---------- توکن ورود (HMAC-SHA256، شبیه JWT ساده) ----------
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signToken(payload, secret, expSeconds = 60 * 60 * 24 * 30) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expSeconds };
  const headerB64 = toBase64Url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(fullPayload)));
  const data = `${headerB64}.${payloadB64}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return `${data}.${toBase64Url(sig)}`;
}

export async function verifyToken(token, secret) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify('HMAC', key, fromBase64Url(sigB64), encoder.encode(`${headerB64}.${payloadB64}`));
  if (!valid) return null;
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)));
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// ---------- کمکی برای مسیرهای محافظت‌شده ----------
// یک AUTH_SECRET پیش‌فرض برای توسعه‌ی محلی؛ در Production حتماً
// متغیر AUTH_SECRET رو در تنظیمات Cloudflare Pages ست کن.
const DEV_FALLBACK_SECRET = 'dabestan-dev-secret-change-me';

export function getSecret(env) {
  return env.AUTH_SECRET || DEV_FALLBACK_SECRET;
}

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}

export async function getAuthUser(context) {
  const { request, env } = context;
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const payload = await verifyToken(token, getSecret(env));
  if (!payload) return null;
  return { id: payload.sub, role: payload.role, schoolId: payload.schoolId };
}

// roles: آرایه‌ای از نقش‌های مجاز، یا null برای «هر کاربر واردشده‌ای»
// در صورت موفقیت user را برمی‌گرداند، در غیر این صورت یک Response خطا برمی‌گرداند.
export async function requireAuth(context, roles = null) {
  const user = await getAuthUser(context);
  if (!user) {
    return { error: jsonResponse({ success: false, message: 'ورود الزامی است' }, 401) };
  }
  if (roles && !roles.includes(user.role)) {
    return { error: jsonResponse({ success: false, message: 'دسترسی غیرمجاز' }, 403) };
  }
  return { user };
}

export function makeInviteCode(prefix) {
  return prefix + Math.random().toString(36).substring(2, 8).toUpperCase();
}
