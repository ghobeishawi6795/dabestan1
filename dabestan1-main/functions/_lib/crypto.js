// هش کردن رمز عبور با SHA-256 (Web Crypto API - در Cloudflare Workers در دسترسه)
// توجه: برای امنیت بیشتر بهتره از یک الگوریتم اختصاصی رمز عبور (bcrypt/scrypt/argon2)
// استفاده بشه، ولی چون توی Workers به‌سادگی در دسترس نیست، حداقل به‌جای
// btoa() (که اصلاً هش نیست و فوراً قابل decode هست) از SHA-256 استفاده می‌کنیم.
export async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password, hash) {
  const computed = await hashPassword(password);
  return computed === hash;
}

// ساخت کد تصادفی (برای کد مدرسه / کد دعوت)
export function generateCode(prefix = '') {
  return prefix + Math.random().toString(36).substring(2, 8).toUpperCase();
}
