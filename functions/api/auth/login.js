// functions/api/auth/login.js
import { verifyPassword } from '../../_lib/crypto.js';

export async function onRequest(context) {
  const { env, request } = context;

  // فقط درخواست‌های POST مجاز هستند
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'متد درخواست نامعتبر است' }), { 
      status: 405, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    const body = await request.json();
    const { inviteCode, password } = body;

    if (!inviteCode || !password) {
      return new Response(JSON.stringify({ success: false, message: 'کد ورود و رمز عبور الزامی هستند' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // جستجوی کاربر بر اساس کد دعوت (invite_code)
    const user = await env.DB.prepare(`
      SELECT id, school_id, name, phone, role, invite_code, is_active, password_hash 
      FROM users 
      WHERE invite_code = ?
    `).bind(inviteCode).first();

    // اگر کاربری پیدا نشد، پیام خطای کلی می‌دهیم (برای امنیت)
    if (!user) {
      return new Response(JSON.stringify({ success: false, message: 'کد ورود یا رمز عبور اشتباه است' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // بررسی فعال بودن حساب
    if (user.is_active !== 1) {
      return new Response(JSON.stringify({ success: false, message: 'حساب کاربری شما هنوز فعال نشده است. با مدیر مدرسه تماس بگیرید.' }), { 
        status: 403, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // بررسی صحت رمز عبور
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return new Response(JSON.stringify({ success: false, message: 'کد ورود یا رمز عبور اشتباه است' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // حذف هش رمز عبور از آبجکت کاربر قبل از ارسال به فرانت‌اند
    const { password_hash, ...safeUser } = user;

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
      message: 'خطای داخلی سرور در هنگام ورود' 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
