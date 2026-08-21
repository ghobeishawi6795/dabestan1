// ========================================
// 🚀 دبستان API - Cloudflare Worker
// ========================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Health check
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'دبستان API is running!'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // ====================================
    // 📝 ثبت‌نام مدیر (اولین کاربر)
    // ====================================
    if (url.pathname === '/api/auth/register-admin' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { schoolName, adminName, phone, password } = body;
        
        // بررسی اینکه آیا مدیری وجود داره یا نه
        const existingAdmin = await env.DB.prepare("SELECT id FROM users WHERE role = 'admin'").first();
        
        if (existingAdmin) {
          return new Response(JSON.stringify({ 
            success: false, 
            message: 'مدیر قبلاً ثبت‌نام کرده است' 
          }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          });
        }
        
        // ساخت کد مدرسه
        const schoolCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // هش کردن رمز عبور (ساده - در محصول واقعی از bcrypt استفاده کن)
        const passwordHash = btoa(password); // فقط برای نمونه!
        
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
        }), { 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });
        
      } catch (error) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'خطا در ثبت‌نام',
          error: error.message 
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });
      }
    }
    
    // ====================================
    // 🔑 ورود با کد (معلم/دانش‌آموز)
    // ====================================
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { inviteCode, password } = body;
        
        const user = await env.DB.prepare(`
          SELECT * FROM users WHERE invite_code = ?
        `).bind(inviteCode).first();
        
        if (!user) {
          return new Response(JSON.stringify({ 
            success: false, 
            message: 'کد ورود نامعتبر است' 
          }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          });
        }
        
        // بررسی رمز عبور
        if (user.password_hash !== btoa(password)) {
          return new Response(JSON.stringify({ 
            success: false, 
            message: 'رمز عبور اشتباه است' 
          }), { 
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          });
        }
        
        // فعال‌سازی کاربر
        await env.DB.prepare(`
          UPDATE users SET is_active = 1 WHERE id = ?
        `).bind(user.id).run();
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'ورود موفق',
          user: {
            id: user.id,
            name: user.name,
            role: user.role,
            schoolId: user.school_id
          }
        }), { 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });
        
      } catch (error) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'خطا در ورود',
          error: error.message 
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        });
      }
    }
    
    // ====================================
    // 👤 دریافت اطلاعات کاربر فعلی
    // ====================================
    if (url.pathname === '/api/me' && request.method === 'GET') {
      // اینجا بعداً با JWT Token پیاده‌سازی می‌شه
      return new Response(JSON.stringify({ 
        message: 'نیاز به احراز هویت' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }
    
    // Default response
    return new Response(JSON.stringify({ 
      message: 'Welcome to Dabestan API',
      version: '1.0.0',
      endpoints: [
        'POST /api/auth/register-admin',
        'POST /api/auth/login',
        'GET  /api/health'
      ]
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};
