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

    // گرفتن school_id از جدول users
    const userRecord = await env.DB.prepare(`
      SELECT school_id FROM users WHERE id = ?
    `).bind(teacher.id).first();

    if (!userRecord) {
      return jsonResponse({ success: false, message: 'کاربر یافت نشد' }, 404);
    }

    await env.DB.prepare(`
      INSERT INTO question_bank
      (teacher_id, title, subject, grade, html_content)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      teacher.id,
      title,
      subject || null,
      grade || null,
      questionHtml
    ).run();

    return jsonResponse({ success: true, message: 'سوال با موفقیت به بانک اضافه شد' });

  } catch (error) {
    console.error('Upload question error:', error);
    return jsonResponse({ success: false, message: 'خطا در آپلود سوال: ' + error.message }, 500);
  }
}
