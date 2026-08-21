export async function onRequest(context) {
  const { env } = context;
  
  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  try {
    const url = new URL(context.request.url);
    const studentId = url.searchParams.get('studentId');
    const taskId = url.searchParams.get('taskId');
    
    if (!studentId) {
      return new Response(JSON.stringify({ success: false, message: 'شناسه دانش‌آموز الزامی است' }), { status: 400 });
    }
    
    // بررسی دانش‌آموز
    const student = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ? AND role = 'student'
    `).bind(studentId).first();
    
    if (!student) {
      return new Response(JSON.stringify({ success: false, message: 'دانش‌آموز یافت نشد' }), { status: 404 });
    }
    
    let query = `
      SELECT s.*, t.title as task_title, t.subject, t.max_score,
             u.name as teacher_name
      FROM submissions s
      JOIN tasks t ON s.task_id = t.id
      JOIN users u ON t.teacher_id = u.id
      WHERE s.student_id = ?
    `;
    const params = [studentId];
    
    if (taskId) {
      query += ' AND s.task_id = ?';
      params.push(taskId);
    }
    
    query += ' ORDER BY s.submitted_at DESC';
    
    const submissions = await env.DB.prepare(query).bind(...params).all();
    
    return new Response(JSON.stringify({ 
      success: true, 
      submissions: submissions.results || []
    }));
    
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500 });
  }
      }
