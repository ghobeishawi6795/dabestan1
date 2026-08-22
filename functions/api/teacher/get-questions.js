import { jsonResponse } from '../_lib/auth.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const url = new URL(request.url);
    const subject = url.searchParams.get('subject');
    const grade = url.searchParams.get('grade');

    // این کوئری همه سوالات را می‌آورد (بدون بررسی لاگین برای تست)
    let query = `
      SELECT id, teacher_id, title, subject, grade, html_content, created_at
      FROM question_bank
    `;
    const params = [];

    if (subject && subject !== 'all') {
      query += ` WHERE subject = ?`;
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
      questions: questions.results || [],
      debug_message: "این نسخه تست است و لاگین را چک نمی‌کند"
    });

  } catch (error) {
    return jsonResponse({ success: false, message: 'خطا: ' + error.message }, 500);
  }
}
