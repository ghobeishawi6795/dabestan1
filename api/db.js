// =============================================
// اتصال به دیتابیس (برای Cloudflare D1)
// =============================================
export function getDb(env) {
  // اگر از D1 استفاده می‌کنید
  if (env.DB) {
    return env.DB;
  }
  
  // برای محیط توسعه با SQLite (wrangler dev)
  // در wrangler.toml باید binding را تنظیم کنید
  throw new Error('Database binding not found');
}
