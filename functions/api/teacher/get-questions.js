import { jsonResponse, requireAuth } from '../_lib/auth.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireAuth(context, ['teacher']);
  if (auth.error) return auth.error;
  const teacher = auth.user;

  try {
    const url = new URL(request.url);
    const subject = url.searchParams.get('subject');
    const grade = url.searchParams.get('grade');

    // ساخت کوئری پویا
    let query = `
      SELECT id, teacher_id, title, subject, grade, html_content, created_at
      FROM question_bank
      WHERE teacher_id = ?
    `;
    const params = [teacher.id];

    if (subject && subject !== 'all') {
      query += ` AND subject = ?`;
      params.push(subject);
    }

    if (grade && grade !== 'all') {
      query += ` AND grade = ?`;
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
