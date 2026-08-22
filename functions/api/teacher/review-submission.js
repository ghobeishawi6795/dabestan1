import { jsonResponse, requireAuth } from '../_lib/auth.js';

// ثبت نمره و بازخورد معلم برای پاسخ یک دانش‌آموز
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
    const { taskId, studentId, score, feedback, status } = body;

    if (!taskId || !studentId) {
      return jsonResponse({ success: false, message: 'شناسه تکلیف و دانش‌آموز الزامی است' }, 400);
    }

    const task = await env.DB.prepare(`SELECT teacher_id FROM tasks WHERE id = ?`).bind(taskId).first();
    if (!task) {
      return jsonResponse({ success: false, message: 'تکلیف یافت نشد' }, 404);
    }
    if (task.teacher_id !== teacher.id) {
      return jsonResponse({ success: false, message: 'دسترسی غیرمجاز' }, 403);
    }

    const finalStatus = status === 'revision' ? 'revision' : 'reviewed';

    const existing = await env.DB.prepare(`
      SELECT id FROM submissions WHERE task_id = ? AND student_id = ?
    `).bind(taskId, studentId).first();

    if (!existing) {
      return jsonResponse({ success: false, message: 'دانش‌آموز هنوز پاسخی ارسال نکرده است' }, 400);
    }

    await env.DB.prepare(`
      UPDATE submissions
      SET score = ?, feedback = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(score ?? null, feedback || null, finalStatus, existing.id).run();

    return jsonResponse({ success: true, message: 'بازخورد با موفقیت ثبت شد' });

  } catch (error) {
    return jsonResponse({ success: false, message: 'خطا در ثبت بازخورد: ' + error.message }, 500);
  }
}
