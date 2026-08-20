export async function onRequest(context) {
  const { env } = context;
  
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  try {
    const body = await context.request.json();
    const { schoolId, teacherName, phone, className, grade } = body;
    
    // بررسی اینکه مدیر هست یا نه
    const admin = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ? AND role = 'admin'
    `).bind(schoolId).first();
    
    if (!admin) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'دسترسی غیرمجاز' 
      }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // ساخت کد دعوت برای معلم
    const inviteCode = 'T' + Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // ساخت کلاس (اگه داده شده)
    let classId = null;
    if (className && grade) {
      await env.DB.prepare(`
        INSERT INTO classes (school_id, name, grade) VALUES (?, ?, ?)
      `).bind(admin.school_id, className, grade).run();
      
      const classResult = await env.DB.prepare(`
        SELECT id FROM classes WHERE school_id = ? AND name = ?
      `).bind(admin.school_id, className).first();
      
      classId = classResult.id;
    }
    
    // ثبت معلم
    const passwordHash = btoa('teacher123'); // رمز پیش‌فرض
    
    await env.DB.prepare(`
      INSERT INTO users (school_id, name, phone, password_hash, role, class_id, invite_code, is_active)
      VALUES (?, ?, ?, ?, 'teacher', ?, ?, 0)
    `).bind(admin.school_id, teacherName, phone, passwordHash, classId, inviteCode).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'معلم با موفقیت اضافه شد',
      inviteCode: inviteCode,
      defaultPassword: 'teacher123'
    }), { 
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'خطا در اضافه کردن معلم',
      error: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
