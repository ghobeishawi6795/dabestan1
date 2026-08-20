export async function onRequest(context) {
  const { env } = context;

  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const url = new URL(context.request.url);
    const studentId = url.searchParams.get('studentId');
    const taskId = url.searchParams.get('taskId');

    if (!studentId || !taskId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'شناسه دانش‌آموز و تکلیف الزامی است'
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

    const task = await env.DB.prepare(`
      SELECT t.*, c.name as class_name, c.grade as class_grade
      FROM tasks t
      LEFT JOIN classes c ON t.class_id = c.id
      WHERE t.id = ? AND t.school_id = ? AND t.is_active = 1
        AND (t.class_id = ? OR t.class_id IS NULL)
    `).bind(taskId, student.school_id, student.class_id).first();

    if (!task) {
      return new Response(JSON.stringify({
        success: false,
        message: 'تکلیف یافت نشد'
      }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const submission = await env.DB.prepare(`
      SELECT * FROM submissions WHERE task_id = ? AND student_id = ?
    `).bind(taskId, studentId).first();

    return new Response(JSON.stringify({
      success: true,
      task,
      submission: submission || null
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'خطا در دریافت تکلیف: ' + error.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
