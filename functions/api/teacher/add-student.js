export async function onRequest(context) {
  const { env } = context;
  
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  try {
    const body = await context.request.json();
    const { teacherId, studentName, phone, className, grade } = body;
    
    // بررسی معلم
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
    
    // ساخت کد دعوت
    const inviteCode = 'S' + Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // پیدا کردن یا ساخت کلاس (فقط اگه className و grade داده شده باشن)
    let classId = null;
    if (className && className.trim() !== '' && grade && grade.trim() !== '') {
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
    
    // ثبت دانش‌آموز
    const passwordHash = btoa('student123');
    
    await env.DB.prepare(`
      INSERT INTO users (school_id, name, phone, password_hash, role, class_id, invite_code, is_active)
      VALUES (?, ?, ?, ?, 'student', ?, ?, 0)
    `).bind(
      teacher.school_id, 
      studentName, 
      phone, 
      passwordHash, 
      classId, 
      inviteCode
    ).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'دانش‌آموز با موفقیت اضافه شد',
      inviteCode: inviteCode,
      defaultPassword: 'student123'
    }), { 
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'خطا در اضافه کردن دانش‌آموز: ' + error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
      }
