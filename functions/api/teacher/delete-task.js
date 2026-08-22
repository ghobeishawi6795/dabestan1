import { jsonResponse, requireAuth } from '../_lib/auth.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'DELETE') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireAuth(context, ['teacher']);
  if (auth.error) return auth.error;
  const teacher = auth.user;

  try {
    const body = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return jsonResponse({ success: false, message: 'شناسه تکلیف الزامی است' }, 400);
    }

    const existing = await env.DB.prepare(`SELECT teacher_id FROM tasks WHERE id = ?`).bind(taskId).first();
    if (!existing) {
      return jsonResponse({ success: false, message: 'تکلیف یافت نشد' }, 404);
    }
    if (existing.teacher_id !== teacher.id) {
      return jsonResponse({ success: false, message: 'دسترسی غیرمجاز' }, 403);
    }

    // حذف نرم - غیرفعال کردن
    await env.DB.prepare(`UPDATE tasks SET is_active = 0 WHERE id = ?`).bind(taskId).run();

    return jsonResponse({ success: true, message: 'تکلیف با موفقیت حذف شد' });

  } catch (error) {
    return jsonResponse({ success: false, message: 'خطا در حذف تکلیف: ' + error.message }, 500);
  }
}
