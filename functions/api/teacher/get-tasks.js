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
    const limit = parseInt(url.searchParams.get('limit')) || 10;

    const tasks = await env.DB.prepare(`
      SELECT t.*, t.response_type as answer_type, c.name as class_name, c.grade as class_grade
      FROM tasks t
      LEFT JOIN classes c ON t.class_id = c.id
      WHERE t.teacher_id = ? AND t.is_active = 1
      ORDER BY t.created_at DESC
      LIMIT ?
    `).bind(teacher.id, limit).all();

    return jsonResponse({ success: true, tasks: tasks.results || [] });

  } catch (error) {
    return jsonResponse({ success: false, message: 'خطا در دریافت تکالیف: ' + error.message }, 500);
  }
}
