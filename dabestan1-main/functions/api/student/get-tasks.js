export async function onRequest(context) {
  const { env } = context;

  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const url = new URL(context.request.url);
    const studentId = url.searchParams.get('studentId');

    if (!studentId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'شناسه دانش‌آموز الزامی است'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const student = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ? AND role = 'student'
    `).bind(studentId).first();

    if (!student) {
      return new Response(JSON.stringify({
        success: false,
        message: 'دسترسی غیرمجاز - دانش‌آموز یافت نشد'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    // تکالیف مربوط به کلاسِ دانش‌آموز (یا تکالیفی که برای کل مدرسه/بدون کلاس خاص ثبت شدن)
    const tasks = await env.DB.prepare(`
      SELECT t.*, c.name as class_name, c.grade as class_grade,
             s.id as submission_id, s.status as submission_status,
             s.score as submission_score, s.created_at as submitted_at
      FROM tasks t
      LEFT JOIN classes c ON t.class_id = c.id
      LEFT JOIN submissions s ON s.task_id = t.id AND s.student_id = ?
      WHERE t.school_id = ? AND t.is_active = 1
        AND (t.class_id = ? OR t.class_id IS NULL)
      ORDER BY t.created_at DESC
    `).bind(studentId, student.school_id, student.class_id).all();

    return new Response(JSON.stringify({
      success: true,
      tasks: tasks.results || []
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'خطا در دریافت تکالیف: ' + error.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
