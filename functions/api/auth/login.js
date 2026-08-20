// functions/api/auth/login.js
import { verifyPassword } from '../../_lib/crypto.js';

export async function onRequest(context) {
  const { env, request } = context;

  // فقط POST مجاز است
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'متد درخواست نامعتبر است' 
    }), { 
      status: 405, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    // خواندن داده‌ها از درخواست
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'فرمت داده‌ها نامعتبر است' 
      }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const { inviteCode, password } = body;

    // بررسی مقادیر
    if (!inviteCode || !password) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'کد ورود و رمز عبور الزامی هستند' 
      }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // جستجوی کاربر در دیتابیس
    const userQuery = await env.DB.prepare(`
      SELECT id, school_id, name, phone, role, invite_code, is_active, password_hash 
      FROM users 
      WHERE invite_code = ? AND is_active = 1
    `).bind(inviteCode).first();

    // اگر کاربری پیدا نشد
    if (!userQuery) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'کد ورود یا رمز عبور اشتباه است' 
      }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // بررسی رمز عبور
    const isPasswordValid = await verifyPassword(password, userQuery.password_hash);
    
    if (!isPasswordValid) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'کد ورود یا رمز عبور اشتباه است' 
      }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // حذف password_hash از پاسخ
    const { password_hash, ...safeUser } = userQuery;

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'ورود با موفقیت انجام شد',
      user: safeUser 
    }), { 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'خطای سرور: ' + error.message 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
