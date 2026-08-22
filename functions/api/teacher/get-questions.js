import { jsonResponse, requireAuth } from '../_lib/auth.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireAuth(context, ['teacher', 'admin']);
  if (auth.error) return auth.error;
  const user = auth.user;

  try {
    const url = new URL(request.url);
    const subject = url.searchParams.get('subject');
    const grade = url.searchParams.get('grade');

    let query = `
      SELECT id, teacher_id, title, subject, grade, html_content, created_at
      FROM question_bank
    `;
    const params = [];

    // اگر کاربر معلم است، فقط سوالات خودش را ببیند (برای امنیت)
    if (user.role === 'teacher' && user.id) {
      query += ` WHERE teacher_id = ?`;
      params.push(user.id);
    }

    if (subject && subject !== 'all') {
      query += (params.length > 0) ? ` AND subject = ?` : ` WHERE subject = ?`;
      params.push(subject);
    }

    if (grade && grade !== 'all') {
      query += (params.length > 0) ? ` AND grade = ?` : ` WHERE grade = ?`;
      params.push(grade);
    }

    query += ` ORDER BY created_at DESC`;

    const questions = await env.DB.prepare(query).bind(...params).all();

    return jsonResponse({ 
      success: true, 
      questions: questions.results || [] 
    });

  } catch (error) {
    console.error('Get questions error:', error);
    return jsonResponse({ success: false, message: 'خطا در دریافت سوالات: ' + error.message }, 500);
  }
}
