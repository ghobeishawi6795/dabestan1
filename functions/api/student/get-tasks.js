import { jsonResponse, requireAuth } from '../_lib/auth.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireAuth(context, ['student']);
  if (auth.error) return auth.error;
  const studentAuth = auth.user;

  try {
    const student = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(studentAuth.id).first();

    if (!student || student.role !== 'student') {
      return jsonResponse({ success: false, message: 'دانش‌آموز یافت نشد' }, 404);
    }

    // گرفتن پایه‌ی دانش‌آموز از روی کلاسش (اگر عضو کلاسی باشد)
    let studentGrade = null;
    if (student.class_id) {
      const cls = await env.DB.prepare(`SELECT grade FROM classes WHERE id = ?`).bind(student.class_id).first();
      studentGrade = cls ? cls.grade : null;
    }

    const tasks = await env.DB.prepare(`
      SELECT t.*, t.response_type as answer_type, c.name as class_name, c.grade as class_grade,
             u.name as teacher_name
      FROM tasks t
      LEFT JOIN classes c ON t.class_id = c.id
      LEFT JOIN users u ON t.teacher_id = u.id
      WHERE (t.class_id = ? OR (t.class_id IS NULL AND t.grade = ?))
        AND t.school_id = ?
        AND t.is_active = 1
        AND (t.deadline IS NULL OR t.deadline > datetime('now'))
      ORDER BY t.created_at DESC
    `).bind(student.class_id || null, studentGrade, student.school_id).all();

    return jsonResponse({ success: true, tasks: tasks.results || [] });

  } catch (error) {
    return jsonResponse({ success: false, message: 'خطا در دریافت تکالیف: ' + error.message }, 500);
  }
}
