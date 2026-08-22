import { jsonResponse, requireAuth } from '../_lib/auth.js';

// لیست دانش‌آموزان کلاسِ یک تکلیف به همراه وضعیت پاسخ‌شان (اگر ارسال شده باشد)
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
    const taskId = url.searchParams.get('taskId');

    if (!taskId) {
      return jsonResponse({ success: false, message: 'شناسه تکلیف الزامی است' }, 400);
    }

    const task = await env.DB.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(taskId).first();
    if (!task) {
      return jsonResponse({ success: false, message: 'تکلیف یافت نشد' }, 404);
    }
    if (task.teacher_id !== teacher.id) {
      return jsonResponse({ success: false, message: 'دسترسی غیرمجاز' }, 403);
    }

    // دانش‌آموزهای مقصد این تکلیف: اعضای همون کلاس، یا اگر کلاس نداره، همه‌ی دانش‌آموزهای همون پایه در مدرسه
    let students;
    if (task.class_id) {
      students = await env.DB.prepare(`
        SELECT id, name FROM users WHERE role = 'student' AND class_id = ? AND school_id = ?
        ORDER BY name
      `).bind(task.class_id, task.school_id).all();
    } else {
      students = await env.DB.prepare(`
        SELECT u.id, u.name FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE u.role = 'student' AND u.school_id = ? AND (c.grade = ? OR ? IS NULL)
        ORDER BY u.name
      `).bind(task.school_id, task.grade, task.grade).all();
    }

    const submissions = await env.DB.prepare(`
      SELECT * FROM submissions WHERE task_id = ?
    `).bind(taskId).all();

    const subByStudent = {};
    for (const s of (submissions.results || [])) {
      subByStudent[s.student_id] = s;
    }

    const rows = (students.results || []).map(st => {
      const sub = subByStudent[st.id];
      return {
        studentId: st.id,
        studentName: st.name,
        submissionId: sub ? sub.id : null,
        status: sub ? sub.status : 'pending', // pending = تحویل‌نداده
        answerText: sub ? sub.answer_text : null,
        score: sub ? sub.score : null,
        feedback: sub ? sub.feedback : null,
        submittedAt: sub ? sub.submitted_at : null
      };
    });

    return jsonResponse({
      success: true,
      task: { id: task.id, title: task.title, subject: task.subject, grade: task.grade, deadline: task.deadline, maxScore: task.max_score },
      submissions: rows
    });

  } catch (error) {
    return jsonResponse({ success: false, message: 'خطا در دریافت پاسخ‌ها: ' + error.message }, 500);
  }
}
