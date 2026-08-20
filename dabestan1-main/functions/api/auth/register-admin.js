import { hashPassword, generateCode } from '../../_lib/crypto.js';

export async function onRequest(context) {
  const { env } = context;

  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await context.request.json();
    const { schoolName, adminName, phone, password } = body;

    if (!schoolName || !adminName || !phone || !password) {
      return new Response(JSON.stringify({
        success: false,
        message: 'همه فیلدها الزامی هستند'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // بررسی اینکه آیا مدیری وجود داره یا نه
    const existingAdmin = await env.DB.prepare("SELECT id FROM users WHERE role = 'admin'").first();

    if (existingAdmin) {
      return new Response(JSON.stringify({
        success: false,
        message: 'مدیر قبلاً ثبت‌نام کرده است'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // ساخت کد مدرسه (همون کد ورود خود مدیر هم هست)
    const schoolCode = generateCode();
    const passwordHash = await hashPassword(password);

    // ثبت مدرسه
    await env.DB.prepare(`
      INSERT INTO schools (name, code) VALUES (?, ?)
    `).bind(schoolName, schoolCode).run();

    const school = await env.DB.prepare("SELECT id FROM schools WHERE code = ?").bind(schoolCode).first();

    // ثبت مدیر - نکته مهم: invite_code مدیر رو هم برابر با schoolCode می‌ذاریم
    // چون فرم ورود (login.js) فقط با invite_code کار می‌کنه، نه با schools.code
    await env.DB.prepare(`
      INSERT INTO users (school_id, name, phone, password_hash, role, invite_code, is_active)
      VALUES (?, ?, ?, ?, 'admin', ?, 1)
    `).bind(school.id, adminName, phone, passwordHash, schoolCode).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'مدیر با موفقیت ثبت‌نام شد',
      schoolCode: schoolCode
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'خطا در ثبت‌نام',
      error: error.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
