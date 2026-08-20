export async function onRequest(context) {
  const { env } = context;

  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const url = new URL(context.request.url);
    const teacherId = url.searchParams.get('teacherId');
    const taskId = url.searchParams.get('taskId');

    if (!teacherId || !taskId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'شناسه معلم و تکلیف الزامی است'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const task = await env.DB.prepare(`
      SELECT * FROM tasks WHERE id = ? AND teacher_id = ?
    `).bind(taskId, teacherId).first();

    if (!task) {
      return new Response(JSON.stringify({
        success: false,
        message: 'دسترسی غیرمجاز - تکلیف یافت نشد'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    // همه‌ی دانش‌آموزان کلاسِ این تکلیف، به همراه پاسخشون (اگه ارسال کرده باشن)
    // اگه تکلیف class_id نداشته باشه (برای کل مدرسه)، همه‌ی دانش‌آموزهای مدرسه رو نشون میده
    let students;
    if (task.class_id) {
      students = await env.DB.prepare(`
        SELECT u.id as student_id, u.name as student_name,
               s.id as submission_id, s.answer_text, s.answer_file, s.answer_file_type,
               s.score, s.feedback, s.status, s.created_at as submitted_at, s.updated_at
        FROM users u
        LEFT JOIN submissions s ON s.student_id = u.id AND s.task_id = ?
        WHERE u.role = 'student' AND u.class_id = ?
        ORDER BY (s.id IS NULL), s.created_at DESC
      `).bind(taskId, task.class_id).all();
    } else {
      students = await env.DB.prepare(`
        SELECT u.id as student_id, u.name as student_name,
               s.id as submission_id, s.answer_text, s.answer_file, s.answer_file_type,
               s.score, s.feedback, s.status, s.created_at as submitted_at, s.updated_at
        FROM users u
        LEFT JOIN submissions s ON s.student_id = u.id AND s.task_id = ?
        WHERE u.role = 'student' AND u.school_id = ?
        ORDER BY (s.id IS NULL), s.created_at DESC
      `).bind(taskId, task.school_id).all();
    }

    return new Response(JSON.stringify({
      success: true,
      task,
      submissions: students.results || []
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'خطا در دریافت پاسخ‌ها: ' + error.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
