export async function onRequest(context) {
  const { env } = context;
  
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  
  try {
    const body = await context.request.json();
    const { schoolName, adminName, phone, password } = body;
    
    // بررسی اینکه آیا مدیری وجود داره یا نه
    const existingAdmin = await env.DB.prepare("SELECT id FROM users WHERE role = 'admin'").first();
    
    if (existingAdmin) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'مدیر قبلاً ثبت‌نام کرده است' 
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    
    // ساخت کد مدرسه
    const schoolCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // هش کردن رمز عبور (ساده)
    const passwordHash = btoa(password);
    
    // ثبت مدرسه
    await env.DB.prepare(`
      INSERT INTO schools (name, code) VALUES (?, ?)
    `).bind(schoolName, schoolCode).run();
    
    const schoolId = await env.DB.prepare("SELECT id FROM schools WHERE code = ?").bind(schoolCode).first();
    
    // ثبت مدیر
    await env.DB.prepare(`
      INSERT INTO users (school_id, name, phone, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, 'admin', 1)
    `).bind(schoolId.id, adminName, phone, passwordHash).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'مدیر با موفقیت ثبت‌نام شد',
      schoolCode: schoolCode
    }), { headers: { 'Content-Type': 'application/json' } });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'خطا در ثبت‌نام',
      error: error.message 
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
