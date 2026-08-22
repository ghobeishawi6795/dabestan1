import { hashPassword, jsonResponse, makeInviteCode, requireAuth } from '../_lib/auth.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireAuth(context, ['teacher']);
  if (auth.error) return auth.error;
  const teacher = auth.user;

  try {
    const body = await request.json();
    const { studentName, phone, className, grade } = body;

    if (!studentName) {
      return jsonResponse({ success: false, message: 'نام دانش‌آموز الزامی است' }, 400);
    }

    const inviteCode = makeInviteCode('S');

    let classId = null;
    if (className && String(className).trim() !== '' && grade && String(grade).trim() !== '') {
      const existingClass = await env.DB.prepare(`
        SELECT id FROM classes WHERE school_id = ? AND name = ? AND grade = ?
      `).bind(teacher.schoolId, className, grade).first();

      if (existingClass) {
        classId = existingClass.id;
      } else {
        const res = await env.DB.prepare(`
          INSERT INTO classes (school_id, name, grade, teacher_id) VALUES (?, ?, ?, ?)
        `).bind(teacher.schoolId, className, grade, teacher.id).run();
        classId = res.meta?.last_row_id || null;
      }
    }

    const defaultPassword = 'student123';
    const passwordHash = await hashPassword(defaultPassword);

    await env.DB.prepare(`
      INSERT INTO users (school_id, name, phone, password_hash, role, class_id, invite_code, is_active)
      VALUES (?, ?, ?, ?, 'student', ?, ?, 0)
    `).bind(teacher.schoolId, studentName, phone || null, passwordHash, classId, inviteCode).run();

    return jsonResponse({
      success: true,
      message: 'دانش‌آموز با موفقیت اضافه شد',
      inviteCode,
      defaultPassword
    });

  } catch (error) {
    return jsonResponse({ success: false, message: 'خطا در اضافه کردن دانش‌آموز: ' + error.message }, 500);
  }
}
