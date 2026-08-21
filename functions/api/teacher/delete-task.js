export async function onRequest(context) {
  const { env } = context;
  
  if (context.request.method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  try {
    const body = await context.request.json();
    const { taskId } = body;
    
    if (!taskId) {
      return new Response(JSON.stringify({ success: false, message: 'شناسه تکلیف الزامی است' }), { status: 400 });
    }
    
    // Soft delete - غیرفعال کردن به جای حذف کامل
    await env.DB.prepare(`
      UPDATE tasks SET is_active = 0 WHERE id = ?
    `).bind(taskId).run();
    
    return new Response(JSON.stringify({ success: true, message: 'تکلیف حذف شد' }));
    
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500 });
  }
}
