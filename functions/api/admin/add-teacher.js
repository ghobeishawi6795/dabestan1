import { hashPassword, jsonResponse, makeInviteCode, requireAuth } from '../_lib/auth.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireAuth(context, ['admin']);
  if (auth.error) return auth.error;
  const admin = auth.user;

  try {
    const body = await request.json();
    const { teacherName, phone, className, grade } = body;

    if (!teacherName) {
      return jsonResponse({ success: false, message: 'نام معلم الزامی است' }, 400);
    }

    const inviteCode = makeInviteCode('T');

    let classId = null;
    if (className && grade) {
      const existingClass = await env.DB.prepare(`
        SELECT id FROM classes WHERE school_id = ? AND name = ? AND grade = ?
      `).bind(admin.schoolId, className, grade).first();

      if (existingClass) {
        classId = existingClass.id;
      } else {
        const res = await env.DB.prepare(`
          INSERT INTO classes (school_id, name, grade) VALUES (?, ?, ?)
        `).bind(admin.schoolId, className, grade).run();
        classId = res.meta?.last_row_id || null;
      }
    }

    const defaultPassword = 'teacher123';
    const passwordHash = await hashPassword(defaultPassword);

    await env.DB.prepare(`
      INSERT INTO users (school_id, name, phone, password_hash, role, class_id, invite_code, is_active)
      VALUES (?, ?, ?, ?, 'teacher', ?, ?, 0)
    `).bind(admin.schoolId, teacherName, phone || null, passwordHash, classId, inviteCode).run();

    // اگه کلاس تازه ساخته شده، معلمش رو ست کن (بعد از ساخت کاربر معلم)
    if (classId) {
      const teacher = await env.DB.prepare(`SELECT id FROM users WHERE invite_code = ?`).bind(inviteCode).first();
      await env.DB.prepare(`UPDATE classes SET teacher_id = ? WHERE id = ?`).bind(teacher.id, classId).run();
    }

    return jsonResponse({
      success: true,
      message: 'معلم با موفقیت اضافه شد',
      inviteCode,
      defaultPassword
    });

  } catch (error) {
    return jsonResponse({ success: false, message: 'خطا در اضافه کردن معلم: ' + error.message }, 500);
  }
}
