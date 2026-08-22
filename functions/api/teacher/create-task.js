import { jsonResponse, requireAuth } from '../_lib/auth.js';

const ALLOWED_RESPONSE_TYPES = ['text', 'image', 'voice', 'file'];

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
    const { title, description, subject, grade, className, deadline, answerType, maxScore } = body;

    if (!title) {
      return jsonResponse({ success: false, message: 'عنوان تکلیف الزامی است' }, 400);
    }

    let classId = null;
    if (className && grade) {
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

    const finalResponseType = ALLOWED_RESPONSE_TYPES.includes(answerType) ? answerType : 'text';
    const finalMaxScore = maxScore || 20;

    const result = await env.DB.prepare(`
      INSERT INTO tasks
      (school_id, teacher_id, class_id, title, description, subject, grade, deadline, response_type, max_score, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(
      teacher.schoolId,
      teacher.id,
      classId,
      title,
      description || '',
      subject || '',
      grade || null,
      deadline || null,
      finalResponseType,
      finalMaxScore
    ).run();

    return jsonResponse({
      success: true,
      message: 'تکلیف با موفقیت ایجاد شد',
      taskId: result.meta?.last_row_id || null
    });

  } catch (error) {
    return jsonResponse({ success: false, message: 'خطا در ایجاد تکلیف: ' + error.message }, 500);
  }
}
