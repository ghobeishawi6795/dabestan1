export async function onRequest(context) {
  const { env } = context;
  
  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  try {
    const url = new URL(context.request.url);
    const teacherId = url.searchParams.get('teacherId');
    const limit = parseInt(url.searchParams.get('limit')) || 10;
    
    if (!teacherId) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'شناسه معلم الزامی است' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // گرفتن لیست تکالیف
    const tasks = await env.DB.prepare(`
      SELECT t.*, c.name as class_name, c.grade as class_grade
      FROM tasks t
      LEFT JOIN classes c ON t.class_id = c.id
      WHERE t.teacher_id = ? AND t.is_active = 1
      ORDER BY t.created_at DESC
      LIMIT ?
    `).bind(teacherId, limit).all();
    
    return new Response(JSON.stringify({ 
      success: true, 
      tasks: tasks.results || []
    }), { 
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'خطا در دریافت تکالیف: ' + error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
