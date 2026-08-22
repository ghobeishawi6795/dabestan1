import { hashPassword } from './_lib/auth.js';

export async function onRequest(context) {
  const { env } = context;
  
  try {
    // ساخت هش رمز عبور "123456"
    const hash = await hashPassword('123456');
    
    // ۱. بازنشانی یا ساخت حساب مدیر
    await env.DB.prepare(`
      INSERT INTO users (id, school_id, name, phone, password_hash, role, invite_code, is_active)
      VALUES (1, 1, 'مدیر کل', '09120000000', ?, 'admin', 'ADMIN-SECRET', 1)
      ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, name = excluded.name, phone = excluded.phone
    `).bind(hash).run();

    // ۲. بازنشانی یا ساخت حساب معلم
    await env.DB.prepare(`
      INSERT INTO users (id, school_id, name, phone, password_hash, role, invite_code, is_active)
      VALUES (2, 1, 'معلم نمونه', '09120000001', ?, 'teacher', 'TEACHER-SECRET', 1)
      ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, name = excluded.name, phone = excluded.phone
    `).bind(hash).run();

    // ۳. بازنشانی یا ساخت حساب دانش‌آموز
    await env.DB.prepare(`
      INSERT INTO users (id, school_id, name, phone, password_hash, role, class_id, invite_code, is_active)
      VALUES (3, 1, 'دانش‌آموز کوشا', '09120000002', ?, 'student', 1, 'STUDENT-SECRET', 1)
      ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, name = excluded.name, phone = excluded.phone
    `).bind(hash).run();

    return new Response(JSON.stringify({ 
      success: true, 
      message: '✅ رمزهای عبور با موفقیت بازنشانی شدند! حالا می‌توانید با رمز 123456 وارد شوید.',
      accounts: [
        { role: 'مدیر', phone: '09120000000', password: '123456' },
        { role: 'معلم', phone: '09120000001', password: '123456' },
        { role: 'دانش‌آموز', phone: '09120000002', password: '123456' }
      ]
    }), { headers: { 'Content-Type': 'application/json' } });
    
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
         }
