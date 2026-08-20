import { hashPassword, generateCode } from '../../_lib/crypto.js';

export async function onRequest(context) {
  const { env } = context;

  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await context.request.json();
    const { adminId, teacherName, phone, className, grade } = body;

    if (!adminId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'دسترسی غیرمجاز - وارد نشده‌اید'
      }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // بررسی اینکه مدیر هست یا نه (با شناسه‌ی خودِ کاربر مدیر، نه شناسه‌ی مدرسه)
    const admin = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ? AND role = 'admin'
    `).bind(adminId).first();

    if (!admin) {
      return new Response(JSON.stringify({
        success: false,
        message: 'دسترسی غیرمجاز'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ساخت کد دعوت برای معلم
    const inviteCode = generateCode('T');

    // ساخت کلاس (اگه داده شده)
    let classId = null;
    if (className && grade) {
      await env.DB.prepare(`
        INSERT INTO classes (school_id, name, grade) VALUES (?, ?, ?)
      `).bind(admin.school_id, className, grade).run();

      const classResult = await env.DB.prepare(`
        SELECT id FROM classes WHERE school_id = ? AND name = ?
      `).bind(admin.school_id, className).first();

      classId = classResult.id;
    }

    // ثبت معلم
    const passwordHash = await hashPassword('teacher123'); // رمز پیش‌فرض

    await env.DB.prepare(`
      INSERT INTO users (school_id, name, phone, password_hash, role, class_id, invite_code, is_active)
      VALUES (?, ?, ?, ?, 'teacher', ?, ?, 0)
    `).bind(admin.school_id, teacherName, phone, passwordHash, classId, inviteCode).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'معلم با موفقیت اضافه شد',
      inviteCode: inviteCode,
      defaultPassword: 'teacher123'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'خطا در اضافه کردن معلم',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
