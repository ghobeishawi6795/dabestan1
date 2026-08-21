export async function onRequest(context) {
  const { env } = context;
  
  if (context.request.method !== 'PUT') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  try {
    const body = await context.request.json();
    const { submissionId, teacherId, score, feedback, status } = body;
    
    if (!submissionId || !teacherId) {
      return new Response(JSON.stringify({ success: false, message: 'شناسه ارسال و معلم الزامی است' }), { status: 400 });
    }
    
    // بررسی معلم
    const teacher = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ? AND role = 'teacher'
    `).bind(teacherId).first();
    
    if (!teacher) {
      return new Response(JSON.stringify({ success: false, message: 'معلم یافت نشد' }), { status: 404 });
    }
    
    // دریافت اطلاعات submission و تکلیف مرتبط
    const submission = await env.DB.prepare(`
      SELECT s.*, t.teacher_id 
      FROM submissions s
      JOIN tasks t ON s.task_id = t.id
      WHERE s.id = ?
    `).bind(submissionId).first();
    
    if (!submission) {
      return new Response(JSON.stringify({ success: false, message: 'ارسال یافت نشد' }), { status: 404 });
    }
    
    // بررسی اینکه تکلیف متعلق به این معلم است
    if (submission.teacher_id !== teacherId) {
      return new Response(JSON.stringify({ success: false, message: 'شما اجازه ویرایش این پاسخ را ندارید' }), { status: 403 });
    }
    
    // به‌روزرسانی submission
    await env.DB.prepare(`
      UPDATE submissions 
      SET score = ?, feedback = ?, status = ?, reviewed_at = datetime('now')
      WHERE id = ?
    `).bind(
      score !== undefined ? score : null,
      feedback || null,
      status || 'reviewed',
      submissionId
    ).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'نمره و بازخورد ثبت شد' 
    }));
    
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500 });
  }
}
