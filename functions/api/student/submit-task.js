import { jsonResponse, requireAuth } from '../_lib/auth.js';

export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const auth = await requireAuth(context, ['student']);
  if (auth.error) return auth.error;
  const studentAuth = auth.user;

  try {
    const body = await request.json();
    const { taskId, answers } = body;

    if (!taskId) {
      return jsonResponse({ success: false, message: 'شناسه تکلیف الزامی است' }, 400);
    }

    const task = await env.DB.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(taskId).first();
    if (!task) {
      return jsonResponse({ success: false, message: 'تکلیف یافت نشد' }, 404);
    }

    if (task.deadline && new Date(task.deadline) < new Date()) {
      return jsonResponse({ success: false, message: 'مهلت ارسال به پایان رسیده است' }, 400);
    }

    const answerText = JSON.stringify(answers || []);

    const existing = await env.DB.prepare(`
      SELECT id FROM submissions WHERE task_id = ? AND student_id = ?
    `).bind(taskId, studentAuth.id).first();

    if (existing) {
      await env.DB.prepare(`
        UPDATE submissions
        SET answer_text = ?, status = 'submitted', submitted_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(answerText, existing.id).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO submissions (task_id, student_id, answer_text, status, submitted_at)
        VALUES (?, ?, ?, 'submitted', datetime('now'))
      `).bind(taskId, studentAuth.id, answerText).run();
    }

    return jsonResponse({ success: true, message: 'پاسخ با موفقیت ثبت شد' });

  } catch (error) {
    return jsonResponse({ success: false, message: 'خطا در ثبت پاسخ: ' + error.message }, 500);
  }
}
