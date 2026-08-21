export async function onRequest(context) {
  const { env } = context;
  
  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  try {
    const url = new URL(context.request.url);
    const taskId = url.searchParams.get('taskId');
    
    if (!taskId) {
      return new Response(JSON.stringify({ success: false, message: 'شناسه تکلیف الزامی است' }), { status: 400 });
    }
    
    const task = await env.DB.prepare(`
      SELECT t.*, c.name as class_name, c.grade as class_grade, u.name as teacher_name
      FROM tasks t
      LEFT JOIN classes c ON t.class_id = c.id
      LEFT JOIN users u ON t.teacher_id = u.id
      WHERE t.id = ?
    `).bind(taskId).first();
    
    if (!task) {
      return new Response(JSON.stringify({ success: false, message: 'تکلیف یافت نشد' }), { status: 404 });
    }
    
    return new Response(JSON.stringify({ success: true, task: task }));
    
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500 });
  }
}
