import { jsonResponse } from '../_lib/auth.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await request.json();
    const { title, subject, grade, className, description, deadline, answerType, maxScore } = body;

    if (!title) {
      return jsonResponse({ success: false, message: 'عنوان تکلیف الزامی است' }, 400);
    }

    // برای تست: استفاده از teacher_id پیش‌فرض
    // در نسخه اصلی باید از توکن گرفته شود
    const teacherId = 1; // یا ID معلم واقعی‌ات را اینجا بگذار
    const schoolId = 1;

    await env.DB.prepare(`
      INSERT INTO tasks (teacher_id, class_id, grade, school_id, title, subject, description, response_type, max_score, is_active, deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).bind(
      teacherId,
      null, // class_id
      grade || null,
      schoolId,
      title,
      subject || null,
      description || '',
      answerType || 'text',
      maxScore || 20,
      deadline || null
    ).run();

    return jsonResponse({ success: true, message: 'تکلیف با موفقیت ایجاد شد' });

  } catch (error) {
    console.error('Create task error:', error);
    return jsonResponse({ success: false, message: 'خطا: ' + error.message }, 500);
  }
}
