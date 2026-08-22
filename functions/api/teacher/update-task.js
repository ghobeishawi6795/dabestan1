import { jsonResponse, requireAuth } from '../_lib/auth.js';

const ALLOWED_RESPONSE_TYPES = ['text', 'image', 'voice', 'file'];

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'PUT') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireAuth(context, ['teacher']);
  if (auth.error) return auth.error;
  const teacher = auth.user;

  try {
    const body = await request.json();
    const { taskId, title, description, subject, grade, deadline, answerType, maxScore, isActive } = body;

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

    const finalResponseType = ALLOWED_RESPONSE_TYPES.includes(answerType) ? answerType : 'text';

    await env.DB.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, subject = ?, grade = ?,
          deadline = ?, response_type = ?, max_score = ?, is_active = ?
      WHERE id = ?
    `).bind(
      title,
      description,
      subject,
      grade,
      deadline || null,
      finalResponseType,
      maxScore || 20,
      isActive !== undefined ? isActive : 1,
      taskId
    ).run();

    return jsonResponse({ success: true, message: 'تکلیف با موفقیت به‌روزرسانی شد' });

  } catch (error) {
    return jsonResponse({ success: false, message: 'خطا در به‌روزرسانی تکلیف: ' + error.message }, 500);
  }
}
