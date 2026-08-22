import { jsonResponse, requireAuth } from '../_lib/auth.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // این endpoint هم برای معلم (ویرایش) و هم برای دانش‌آموز (مشاهده تکلیف) استفاده می‌شه
  const auth = await requireAuth(context, null);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('taskId');

    if (!taskId) {
      return jsonResponse({ success: false, message: 'شناسه تکلیف الزامی است' }, 400);
    }

    const task = await env.DB.prepare(`
      SELECT t.*, t.response_type as answer_type, c.name as class_name, c.grade as class_grade,
             u.name as teacher_name
      FROM tasks t
      LEFT JOIN classes c ON t.class_id = c.id
      LEFT JOIN users u ON t.teacher_id = u.id
      WHERE t.id = ?
    `).bind(taskId).first();

    if (!task) {
      return jsonResponse({ success: false, message: 'تکلیف یافت نشد' }, 404);
    }

    return jsonResponse({ success: true, task });

  } catch (error) {
    return jsonResponse({ success: false, message: 'خطا در دریافت اطلاعات تکلیف: ' + error.message }, 500);
  }
}
