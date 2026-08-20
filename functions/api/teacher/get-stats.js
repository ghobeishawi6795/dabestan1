export async function onRequest(context) {
  const { env } = context;

  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const url = new URL(context.request.url);
    const teacherId = url.searchParams.get('teacherId');

    if (!teacherId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'شناسه معلم الزامی است'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const teacher = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ? AND role = 'teacher'
    `).bind(teacherId).first();

    if (!teacher) {
      return new Response(JSON.stringify({
        success: false,
        message: 'دسترسی غیرمجاز'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const activeTasks = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM tasks WHERE teacher_id = ? AND is_active = 1
    `).bind(teacherId).first();

    const classCount = await env.DB.prepare(`
      SELECT COUNT(DISTINCT class_id) as count FROM tasks
      WHERE teacher_id = ? AND is_active = 1 AND class_id IS NOT NULL
    `).bind(teacherId).first();

    const pendingReview = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM submissions s
      JOIN tasks t ON t.id = s.task_id
      WHERE t.teacher_id = ? AND s.status IN ('pending', 'revision')
    `).bind(teacherId).first();

    return new Response(JSON.stringify({
      success: true,
      activeTaskCount: activeTasks.count || 0,
      classCount: classCount.count || 0,
      pendingReviewCount: pendingReview.count || 0
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'خطا در دریافت آمار: ' + error.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
