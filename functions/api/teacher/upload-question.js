import { jsonResponse, requireAuth } from '../_lib/auth.js';

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
    const { title, subject, grade, questionHtml, questionType } = body;

    if (!title || !questionHtml) {
      return jsonResponse({ success: false, message: 'عنوان و محتوای سوال الزامی است' }, 400);
    }

    await env.DB.prepare(`
      INSERT INTO question_bank
      (school_id, teacher_id, title, subject, grade, question_html, question_type, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(
      teacher.schoolId,
      teacher.id,
      title,
      subject || null,
      grade || null,
      questionHtml,
      questionType || 'html'
    ).run();

    return jsonResponse({ success: true, message: 'سوال با موفقیت به بانک اضافه شد' });

  } catch (error) {
    return jsonResponse({ success: false, message: 'خطا در آپلود سوال: ' + error.message }, 500);
  }
}
