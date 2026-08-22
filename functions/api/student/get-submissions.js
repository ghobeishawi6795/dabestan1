import { jsonResponse, requireAuth } from '../_lib/auth.js';

// نمرات و وضعیت پاسخ‌های ارسال‌شده‌ی دانش‌آموز
export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireAuth(context, ['student']);
  if (auth.error) return auth.error;
  const student = auth.user;

  try {
    const submissions = await env.DB.prepare(`
      SELECT s.id, s.task_id, s.status, s.score, s.feedback, s.submitted_at,
             t.title, t.subject, t.max_score
      FROM submissions s
      LEFT JOIN tasks t ON s.task_id = t.id
      WHERE s.student_id = ?
      ORDER BY s.submitted_at DESC
    `).bind(student.id).all();

    return jsonResponse({ success: true, submissions: submissions.results || [] });

  } catch (error) {
    return jsonResponse({ success: false, message: 'خطا در دریافت نمرات: ' + error.message }, 500);
  }
}
