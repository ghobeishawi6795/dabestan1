export async function onRequest(context) {
  const { env } = context;
  
  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  try {
    const url = new URL(context.request.url);
    const taskId = url.searchParams.get('taskId');
    const teacherId = url.searchParams.get('teacherId');
    
    if (!taskId || !teacherId) {
      return new Response(JSON.stringify({ success: false, message: 'شناسه تکلیف و معلم الزامی است' }), { status: 400 });
    }
    
    // بررسی معلم
    const teacher = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ? AND role = 'teacher'
    `).bind(teacherId).first();
    
    if (!teacher) {
      return new Response(JSON.stringify({ success: false, message: 'معلم یافت نشد' }), { status: 404 });
    }
    
    // بررسی تکلیف متعلق به این معلم
    const task = await env.DB.prepare(`
      SELECT * FROM tasks WHERE id = ? AND teacher_id = ?
    `).bind(taskId, teacherId).first();
    
    if (!task) {
      return new Response(JSON.stringify({ success: false, message: 'تکلیف یافت نشد' }), { status: 404 });
    }
    
    // دریافت همه پاسخ‌های این تکلیف
    const submissions = await env.DB.prepare(`
      SELECT s.*, u.name as student_name, u.username as student_username
      FROM submissions s
      JOIN users u ON s.student_id = u.id
      WHERE s.task_id = ?
      ORDER BY s.submitted_at DESC
    `).bind(taskId).all();
    
    return new Response(JSON.stringify({ 
      success: true, 
      submissions: submissions.results || [],
      task: task
    }));
    
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500 });
  }
  }
