export async function onRequest(context) {
  const { env } = context;
  
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  try {
    const body = await context.request.json();
    const { teacherId, title, subject, grade, questionHtml, questionType } = body;
    
    // بررسی معلم
    const teacher = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ? AND role = 'teacher'
    `).bind(teacherId).first();
    
    if (!teacher) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'دسترسی غیرمجاز' 
      }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // ثبت سوال در بانک
    await env.DB.prepare(`
      INSERT INTO question_bank 
      (school_id, teacher_id, title, subject, grade, question_html, question_type, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(
      teacher.school_id,
      teacher.id,
      title,
      subject || null,
      grade || null,
      questionHtml,
      questionType || 'html'
    ).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'سوال با موفقیت به بانک اضافه شد'
    }), { 
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'خطا در آپلود سوال: ' + error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  }
