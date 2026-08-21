export async function onRequest(context) {
  const { env } = context;
  
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  try {
    const body = await context.request.json();
    const { teacherId, questions } = body;
    
    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'هیچ سوالی برای آپلود وجود ندارد' 
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    
    // بررسی معلم
    const teacher = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ?
    `).bind(teacherId).first();
    
    if (!teacher) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'کاربر یافت نشد. لطفاً دوباره وارد شوید.' 
      }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
    
    // آپلود همه سوالات
    let uploadedCount = 0;
    for (const q of questions) {
      try {
        await env.DB.prepare(`
          INSERT INTO question_bank 
          (school_id, teacher_id, title, subject, grade, question_html, question_type, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `).bind(
          teacher.school_id,
          teacher.id,
          q.title,
          q.subject || null,
          q.grade || null,
          q.html,
          q.questionType || 'html'
        ).run();
        uploadedCount++;
      } catch (err) {
        console.error('Failed to upload question:', q.title, err);
      }
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: `${uploadedCount} سوال با موفقیت آپلود شد`,
      uploadedCount: uploadedCount
    }), { headers: { 'Content-Type': 'application/json' } });
    
  } catch (error) {
    console.error('Batch upload error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'خطا در آپلود: ' + error.message 
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
          }
