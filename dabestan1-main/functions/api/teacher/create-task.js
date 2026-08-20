export async function onRequest(context) {
  const { env } = context;
  
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  try {
    const body = await context.request.json();
    const { 
      teacherId, 
      title, 
      description, 
      subject, 
      grade, 
      className, 
      deadline, 
      answerType,
      maxScore 
    } = body;

    if (!teacherId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'دسترسی غیرمجاز - وارد نشده‌اید'
      }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // بررسی اینکه معلم هست یا نه
    const teacher = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ? AND role = 'teacher'
    `).bind(teacherId).first();
    
    if (!teacher) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'دسترسی غیرمجاز - معلم یافت نشد' 
      }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // پیدا کردن یا ساخت کلاس
    let classId = null;
    if (className && grade) {
      const existingClass = await env.DB.prepare(`
        SELECT id FROM classes WHERE school_id = ? AND name = ? AND grade = ?
      `).bind(teacher.school_id, className, grade).first();
      
      if (existingClass) {
        classId = existingClass.id;
      } else {
        await env.DB.prepare(`
          INSERT INTO classes (school_id, name, grade, teacher_id) VALUES (?, ?, ?, ?)
        `).bind(teacher.school_id, className, grade, teacher.id).run();
        
        const classResult = await env.DB.prepare(`
          SELECT id FROM classes WHERE school_id = ? AND name = ? AND grade = ?
        `).bind(teacher.school_id, className, grade).first();
        
        classId = classResult ? classResult.id : null;
      }
    }
    
    // مقدار پیش‌فرض برای فیلدهای اختیاری
    const finalAnswerType = answerType || 'text';
    const finalMaxScore = maxScore || 20;
    const finalDeadline = deadline || null;
    
    // ثبت تکلیف
    const result = await env.DB.prepare(`
      INSERT INTO tasks 
      (school_id, teacher_id, class_id, title, description, subject, grade, deadline, answer_type, max_score, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(
      teacher.school_id,
      teacher.id,
      classId,
      title,
      description || '',
      subject || '',
      grade || null,
      finalDeadline,
      finalAnswerType,
      finalMaxScore
    ).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'تکلیف با موفقیت ایجاد شد',
      taskId: result.meta?.last_row_id || null
    }), { 
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'خطا در ایجاد تکلیف: ' + error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
                }
