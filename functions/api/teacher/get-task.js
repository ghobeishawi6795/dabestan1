export async function onRequest(context) {
  const { env } = context;
  
  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  try {
    const url = new URL(context.request.url);
    const taskId = url.searchParams.get('taskId');
    
    if (!taskId) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'شناسه تکلیف الزامی است' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const task = await env.DB.prepare(`
      SELECT t.*, c.name as class_name, c.grade as class_grade
      FROM tasks t
      LEFT JOIN classes c ON t.class_id = c.id
      WHERE t.id = ?
    `).bind(taskId).first();
    
    if (!task) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'تکلیف یافت نشد' 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      task: task
    }), { 
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'خطا در دریافت اطلاعات تکلیف: ' + error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
