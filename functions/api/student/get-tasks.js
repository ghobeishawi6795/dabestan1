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
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // دریافت اطلاعات دانش‌آموز
    const student = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ?
    `).bind(studentId).first();
    
    if (!student || student.role !== 'student') {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'دانش‌آموز یافت نشد' 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // دریافت تکالیف بر اساس پایه و کلاس
    const tasks = await env.DB.prepare(`
      SELECT t.*, c.name as class_name, c.grade as class_grade,
             u.name as teacher_name
      FROM tasks t
      LEFT JOIN classes c ON t.class_id = c.id
      LEFT JOIN users u ON t.teacher_id = u.id
      WHERE (c.id = ? OR t.grade = ?) 
        AND t.is_active = 1
        AND (t.deadline IS NULL OR t.deadline > datetime('now'))
      ORDER BY t.created_at DESC
    `).bind(student.class || null, student.grade || null).all();
    
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
