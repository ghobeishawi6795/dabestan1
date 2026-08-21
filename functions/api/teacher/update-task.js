export async function onRequest(context) {
  const { env } = context;
  
  if (context.request.method !== 'PUT') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  try {
    const body = await context.request.json();
    const { taskId, title, description, subject, grade, className, deadline, answerType, maxScore, isActive } = body;
    
    if (!taskId) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'شناسه تکلیف الزامی است' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // به‌روزرسانی تکلیف
    await env.DB.prepare(`
      UPDATE tasks 
      SET title = ?, description = ?, subject = ?, grade = ?, 
          deadline = ?, answer_type = ?, max_score = ?, is_active = ?
      WHERE id = ?
    `).bind(
      title,
      description,
      subject,
      grade,
      deadline,
      answerType,
      maxScore,
      isActive !== undefined ? isActive : 1,
      taskId
    ).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'تکلیف با موفقیت به‌روزرسانی شد'
    }), { 
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'خطا در به‌روزرسانی تکلیف: ' + error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
