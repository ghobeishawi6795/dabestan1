export async function onRequest(context) {
  const { env } = context;

  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await context.request.json();
    const { teacherId, taskId } = body;

    if (!teacherId || !taskId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'شناسه معلم و تکلیف الزامی است'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const task = await env.DB.prepare(`
      SELECT id FROM tasks WHERE id = ? AND teacher_id = ?
    `).bind(taskId, teacherId).first();

    if (!task) {
      return new Response(JSON.stringify({
        success: false,
        message: 'دسترسی غیرمجاز - تکلیف یافت نشد'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    await env.DB.prepare(`
      UPDATE tasks SET is_active = 0 WHERE id = ?
    `).bind(taskId).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'تکلیف حذف شد'
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'خطا در حذف تکلیف: ' + error.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
